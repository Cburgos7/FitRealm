/**
 * kalman.ts — 1D Kalman filter for GPS coordinate smoothing (MOV-02)
 *
 * Usage:
 *   const latFilter = new KalmanFilter({ Q: 0.00001, R: 0.0001 });
 *   latFilter.reset(initialLat);
 *   const smoothedLat = latFilter.filter(rawLat);
 *
 * Q (process noise) and R (measurement noise) are injectable from
 * game_config (kalman_process_noise / kalman_measurement_noise) to allow
 * remote tuning without a release.
 */

export interface KalmanFilterOptions {
  /** Process noise — controls how quickly the filter adapts to change (Q). */
  Q?: number;
  /** Measurement noise — controls how much weight is given to new readings (R). */
  R?: number;
}

export class KalmanFilter {
  private Q: number;
  private R: number;
  /** Estimation error covariance */
  private P: number;
  /** State estimate (current best guess) */
  private x: number;
  /** Most recent Kalman gain — exposed for tests */
  public lastGain: number;

  constructor(options: KalmanFilterOptions = {}) {
    this.Q = options.Q ?? 0.00001;
    this.R = options.R ?? 0.0001;
    this.P = 1;
    this.x = 0;
    this.lastGain = 0;
  }

  /**
   * Seed the filter state from a known starting value (e.g., the first GPS fix).
   * Also resets error covariance so the filter starts fresh.
   */
  reset(initialValue: number): void {
    this.x = initialValue;
    this.P = 1;
    this.lastGain = 0;
  }

  /**
   * Feed a new measurement into the filter.
   * Returns the smoothed estimate.
   */
  filter(measurement: number): number {
    // Predict step: propagate error covariance
    this.P += this.Q;

    // Update step: compute Kalman gain
    this.lastGain = this.P / (this.P + this.R);

    // Update state estimate
    this.x = this.x + this.lastGain * (measurement - this.x);

    // Update error covariance
    this.P = (1 - this.lastGain) * this.P;

    return this.x;
  }

  /** Current state estimate (without feeding a new measurement). */
  get value(): number {
    return this.x;
  }
}
