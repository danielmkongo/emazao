/**
 * Small vibrations that confirm a tap landed.
 *
 * A like or a reaction has almost no visual weight — the emoji flies off and
 * is gone — so without a buzz it is genuinely unclear whether the tap
 * registered at all. Android fires these through the Vibration API; iOS Safari
 * has never supported it, so everything here is best-effort and silent when
 * unavailable, and nothing may depend on it having happened.
 */

type Pattern = number | number[]

function buzz(pattern: Pattern) {
  try {
    // Absent on iOS, and throws inside cross-origin iframes on some browsers.
    navigator.vibrate?.(pattern)
  } catch { /* haptics are a courtesy, never a requirement */ }
}

/** A tap landed: selecting, toggling, opening. */
export const tapHaptic = () => buzz(10)

/** Something was added — a like, a reaction, a follow. */
export const likeHaptic = () => buzz([0, 18, 40, 22])

/** Something was taken back. Shorter and flatter than adding it. */
export const unlikeHaptic = () => buzz(14)

/** A send completed. */
export const sendHaptic = () => buzz([0, 12, 30, 12])
