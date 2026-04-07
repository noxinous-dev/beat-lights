/** Default track — SoundCloud permalink (no query/tracking params). */
export const DEFAULT_SOUNDCLOUD_TRACK =
  'https://soundcloud.com/nicholas-macias-274143117/poster-boy-best-part-looped'

/** Embeddable player URL for the SoundCloud HTML5 widget. */
export function soundcloudPlayerSrc(trackPermalink: string): string {
  const q = new URLSearchParams({
    url: trackPermalink,
    color: '#ff5500',
    auto_play: 'false',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    visual: 'false',
  })
  return `https://w.soundcloud.com/player/?${q.toString()}`
}
