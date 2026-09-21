import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { looksLikeVideo, videoPoster } from '@/lib/media'

/**
 * A reel's cover image.
 *
 * Tried in order: the stored thumbnail, then a frame Cloudinary cuts from the
 * video on request, and only then the video element itself. That last step is
 * a poor fallback on iPhones, which will not paint a frame from a video that
 * has not been played, so a reel shared into a chat showed up as an empty
 * black card; the Cloudinary frame means it very rarely gets that far.
 */
export function ReelThumb({ thumbnailUrl, videoUrl, className }: { thumbnailUrl?: string; videoUrl?: string; className?: string }) {
  const candidates = useMemo(() => {
    const list: string[] = []
    // A "thumbnail" that is really the video (old .mov/.webm uploads) is skipped.
    if (thumbnailUrl && thumbnailUrl !== videoUrl && !looksLikeVideo(thumbnailUrl)) list.push(thumbnailUrl)
    const poster = videoPoster(videoUrl)
    if (poster && !list.includes(poster)) list.push(poster)
    return list
  }, [thumbnailUrl, videoUrl])

  const [attempt, setAttempt] = useState(0)
  useEffect(() => { setAttempt(0) }, [candidates])

  const src = candidates[attempt]
  if (src) {
    return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setAttempt(a => a + 1)} className={cn('object-cover', className)} />
  }
  if (!videoUrl) return <span className={cn('bg-neutral-900', className)} />
  return <video src={`${videoUrl}#t=0.1`} preload="metadata" muted playsInline className={cn('object-cover bg-neutral-900', className)} />
}
