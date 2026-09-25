/*
 * A percentage needs a denominator big enough to mean something.
 *
 * "33%" from three buyers is not a third of anything you can act on -- it is
 * one buyer, and the next one moves it to 50% or 25%. Shown as a percentage it
 * reads like a measured rate; shown as "1 of 3 buyers" it reads like what it
 * is. The arithmetic was never wrong. The presentation implied a precision the
 * data does not carry.
 *
 * So below MIN_SAMPLE the count is shown instead of the rate, everywhere a
 * rate appears. Above it, the percentage stands as before.
 *
 * MIN_SAMPLE is 10 on the owner's instruction (2026-09-25), as a starting
 * point, and is meant to be adjusted once there is enough history to say what
 * the right floor is. It lives here alone: two pages read it, and a second
 * copy is how the two would drift apart.
 *
 * This is deliberately NOT applied to bar widths. A bar 40% as long as the
 * longest bar beside it is a drawing instruction, not a claim about a
 * population, and thresholding it would leave a chart with missing bars.
 */
(function (root) {
  'use strict';

  var MIN_SAMPLE = 10;

  /** True when a denominator is large enough for a percentage to be honest. */
  function enough(denominator) {
    var d = Number(denominator);
    return isFinite(d) && d >= MIN_SAMPLE;
  }

  /**
   * A rate, as a percentage when the sample supports one and as a count when
   * it does not.
   *
   *   rate(3, 9,  {noun: 'buyers'})  -> "3 of 9 buyers"
   *   rate(33, 99, {noun: 'buyers'}) -> "33.3%"
   *   rate(0, 0,  {noun: 'buyers'})  -> "n/a"
   *
   * `numerator` may be null when only the rate is known; below the threshold
   * that yields the denominator alone, because a count cannot be printed
   * without the count.
   */
  function rate(numerator, denominator, opts) {
    var o = opts || {};
    var d = Number(denominator);
    var n = numerator === null || numerator === undefined ? null : Number(numerator);
    var noun = o.noun || '';
    var digits = o.digits === undefined ? 1 : o.digits;

    if (!isFinite(d) || d <= 0) return o.empty || 'n/a';

    if (!enough(d)) {
      if (n === null || !isFinite(n)) {
        return d + (noun ? ' ' + noun : '') + ' so far';
      }
      return n + ' of ' + d + (noun ? ' ' + noun : '');
    }

    if (n === null || !isFinite(n)) return o.empty || 'n/a';
    return (n / d * 100).toFixed(digits) + '%';
  }

  /** Why a figure is showing a count. Used for the note under it. */
  function note(denominator, opts) {
    if (enough(denominator)) return '';
    var o = opts || {};
    return 'Shown as a count rather than a percentage: fewer than ' + MIN_SAMPLE +
      ' ' + (o.noun || 'records') + ' is too small a sample for a rate to mean much.';
  }

  root.SmallSample = { MIN_SAMPLE: MIN_SAMPLE, enough: enough, rate: rate, note: note };
})(typeof window !== 'undefined' ? window : this);
