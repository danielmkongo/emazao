/**
 * Turn what someone typed into a search box into a safe, literal pattern.
 *
 * Passed straight to $regex, a search is a program the database — and, for
 * some operators, Node — has to run. A crafted pattern such as (a+)+$ can take
 * exponential time, and on a single-threaded server that stalls every other
 * request while it runs. Escaped, "a+b" just looks for the text "a+b". The
 * length cap keeps a pasted essay from becoming an expensive scan.
 */
export function literal(input: unknown, maxLength = 80): string {
  return String(input ?? '').slice(0, maxLength).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
