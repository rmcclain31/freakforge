/**
 * Data Service
 * Loads and provides access to athlete combine data
 */

class DataService {
  constructor() {
    this.athletes = [];
    this.statistics = {};
    this.loaded = false;
  }

  async loadData() {
    try {
      // In development, load from the sample JSON file
      const response = await fetch('/athletes_sample_100.json');
      const data = await response.json();

      this.athletes = data.athletes || [];
      this.statistics = data.metricStatistics || {};
      this.loaded = true;

      return {
        athletes: this.athletes,
        statistics: this.statistics,
        totalRecords: data.totalRecords || this.athletes.length
      };
    } catch (error) {
      console.error('Error loading athlete data:', error);
      return {
        athletes: [],
        statistics: {},
        totalRecords: 0
      };
    }
  }

  getAthletes() {
    return this.athletes;
  }

  getAthlete(id) {
    return this.athletes.find(a => a.id === id);
  }

  getStatistics() {
    return this.statistics;
  }

  searchAthletes(query) {
    const lowerQuery = query.toLowerCase();
    return this.athletes.filter(athlete =>
      athlete.firstName.toLowerCase().includes(lowerQuery) ||
      athlete.lastName.toLowerCase().includes(lowerQuery) ||
      athlete.position.toLowerCase().includes(lowerQuery)
    );
  }

  getAthletesByPosition(position) {
    return this.athletes.filter(a => a.position === position);
  }

  calculatePercentile(metricName, value) {
    const stats = this.statistics[metricName];
    if (!stats || !stats.mean || !stats.std) return 50;

    // Calculate z-score
    const z = (value - stats.mean) / stats.std;

    // Convert to percentile (approximate using normal distribution)
    // For times (lower is better), invert the z-score
    const isTimeBased = ['dash40', 'proAgility', 'lDrill'].includes(metricName);
    const adjustedZ = isTimeBased ? -z : z;

    // Approximate percentile from z-score
    const percentile = Math.max(0, Math.min(100, 50 + adjustedZ * 34));
    return Math.round(percentile);
  }

  calculateSigma(metricName, value) {
    const stats = this.statistics[metricName];
    if (!stats || !stats.mean || !stats.std) return 0;

    // For times, invert so that faster = positive sigma
    const isTimeBased = ['dash40', 'proAgility', 'lDrill'].includes(metricName);
    const z = (value - stats.mean) / stats.std;

    return isTimeBased ? -z : z;
  }
}

// Create singleton instance
const dataService = new DataService();

export default dataService;