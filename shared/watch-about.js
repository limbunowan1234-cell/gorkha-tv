// "About this video" block for the server-rendered watch page
// (functions/watch/[id].js). Watch pages were mostly a YouTube embed plus the
// uploader's own description (often empty or copy-pasted across a channel), so
// Google crawled thousands of them and indexed few. This adds only facts we
// actually hold about the video and its channel, written as plain sentences:
// what it is, who made it and when, where it is from, plus the channel's own
// description and its other uploads. Nothing is generated or padded; a field
// that is missing is simply left out.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatLongDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}

export function formatLongDuration(seconds) {
  const s = Number(seconds);
  if (!s || s < 1) return null;
  if (s < 60) return `${s} seconds`;
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  if (h) return min ? `${h} hr ${min} min` : `${h} hr`;
  return `${min} min`;
}

// First `max` characters of free text, cut at a word boundary, links removed.
// Returns '' when too little is left to be worth showing.
export function plainExcerpt(text, max = 320) {
  const clean = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length < 40) return '';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?—-]+$/, '')}…`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// video: row from the videos table. channel: { channel_name, slug, description, videoCount } | null.
// categoryLabel/categoryHref: optional. moreFromChannel: [{ youtube_video_id, title, published_at }].
export function aboutVideoHTML({ video, channel, categoryLabel, categoryHref, moreFromChannel = [] }) {
  const date = formatLongDate(video.published_at);
  const duration = formatLongDuration(video.duration_seconds);
  const views = video.view_count ? Number(video.view_count).toLocaleString('en-IN') : null;
  const channelName = channel?.channel_name || video.channel_name;
  const channelHref = channel?.slug ? `/${encodeURIComponent(channel.slug)}` : null;
  const channelHTML = channelName ? (channelHref ? `<a href="${esc(channelHref)}">${esc(channelName)}</a>` : esc(channelName)) : null;

  const sentences = [];
  let first = `<strong>${esc(video.title)}</strong>`;
  first += channelHTML ? ` is a video from ${channelHTML}` : ' is a video on GorkhaTV';
  if (date) first += `, published on ${esc(date)}`;
  if (duration) first += ` and running ${esc(duration)}`;
  sentences.push(`${first}.`);
  if (categoryLabel) {
    const cat = categoryHref ? `<a href="${esc(categoryHref)}">${esc(categoryLabel)}</a>` : esc(categoryLabel);
    sentences.push(`GorkhaTV lists it under ${cat}${video.location ? ` and ties it to ${esc(video.location)}` : ''}.`);
  } else if (video.location) {
    sentences.push(`GorkhaTV ties it to ${esc(video.location)}.`);
  }
  if (views) sentences.push(`It has been watched ${esc(views)} times on YouTube.`);

  let html = `<h2 class="watch-about-title">About this video</h2><p>${sentences.join(' ')}</p>`;

  const blurb = plainExcerpt(channel?.description);
  if (channelName && (blurb || channel?.videoCount > 1)) {
    const count = channel?.videoCount > 1 ? ` ${esc(channelName)} has ${channel.videoCount} videos on GorkhaTV.` : '';
    html += `<h2 class="watch-about-title">About ${channelHTML}</h2><p>${blurb ? esc(blurb) : ''}${count}</p>`;
  }

  if (moreFromChannel.length) {
    html += `<h2 class="watch-about-title">More from ${esc(channelName || 'this channel')}</h2><ul class="watch-about-list">${moreFromChannel
      .map((v) => {
        const d = formatLongDate(v.published_at);
        return `<li><a href="/watch/${esc(v.youtube_video_id)}">${esc(v.title)}</a>${d ? ` <span>· ${esc(d)}</span>` : ''}</li>`;
      })
      .join('')}</ul>`;
  }
  return html;
}
