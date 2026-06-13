/*
  SEO.js — dynamic meta tags + JSON-LD for video.html
  Call updateSEO(contentDoc) after fetching the content document from Appwrite.
  Assumes fields: title, description, thumbnail (URL), $id, genre (optional), datePublished (optional)
*/

function updateSEO(doc) {
  const baseUrl = "https://gorkhatv.site";
  const pageUrl = `${baseUrl}/pages/video.html?id=${doc.$id}`;
  const title = `${doc.title} | GorkhaTV`;
  const description = doc.description
    ? doc.description.slice(0, 160)
    : `Watch ${doc.title} on GorkhaTV — Gorkha and Darjeeling entertainment.`;
  const thumbnail = doc.youtube_id
    ? `https://img.youtube.com/vi/${doc.youtube_id}/hqdefault.jpg`
    : `${baseUrl}/assets/default-thumbnail.jpg`;

  // Title
  document.title = title;

  // Meta description
  setMeta("description", description);

  // Canonical
  setLink("canonical", pageUrl);

  // Open Graph
  setMeta("og:title", title, "property");
  setMeta("og:description", description, "property");
  setMeta("og:image", thumbnail, "property");
  setMeta("og:url", pageUrl, "property");
  setMeta("og:type", "video.other", "property");

  // Twitter Card
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", title);
  setMeta("twitter:description", description);
  setMeta("twitter:image", thumbnail);

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": doc.title,
    "description": description,
    "thumbnailUrl": thumbnail,
    "uploadDate": doc.datePublished || doc.$createdAt || new Date().toISOString(),
    "embedUrl": doc.youtube_id
      ? `https://www.youtube.com/embed/${doc.youtube_id}`
      : pageUrl,
    "url": pageUrl
  };

  let script = document.getElementById("video-jsonld");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "video-jsonld";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}

// --- Helpers ---
function setMeta(name, content, attr = "name") {
  let tag = document.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setLink(rel, href) {
  let tag = document.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

/*
  updateArtistSEO — call after artist doc + photoUrl are resolved on artist.html
  artist: { name, profession, bio, location, slug, ... }
  photoUrl: resolved storage URL or null
*/
function updateArtistSEO(artist, photoUrl) {
  const baseUrl = "https://gorkhatv.site";
  const pageUrl = `${baseUrl}/pages/artist.html?id=${artist.slug}`;
  const title = `${artist.name} — ${artist.profession || 'Artist'} | GorkhaTV`;
  const description = artist.bio
    ? artist.bio.slice(0, 160)
    : `${artist.name} on GorkhaTV — ${artist.profession || 'artist'}${artist.location ? ' from ' + artist.location : ''}. View filmography and credits.`;
  const image = photoUrl || `${baseUrl}/logo-circle.png`;

  document.title = title;
  setMeta("description", description);
  setLink("canonical", pageUrl);

  setMeta("og:title", title, "property");
  setMeta("og:description", description, "property");
  setMeta("og:image", image, "property");
  setMeta("og:url", pageUrl, "property");
  setMeta("og:type", "profile", "property");

  setMeta("twitter:card", "summary");
  setMeta("twitter:title", title);
  setMeta("twitter:description", description);
  setMeta("twitter:image", image);

  // JSON-LD Person schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": artist.name,
    "description": description,
    "image": image,
    "url": pageUrl,
    "jobTitle": artist.profession || undefined,
    "address": artist.location ? { "@type": "PostalAddress", "addressLocality": artist.location } : undefined,
    "sameAs": [artist.instagram ? `https://instagram.com/${artist.instagram.replace('@','')}` : null, artist.youtube || null].filter(Boolean)
  };

  let script = document.getElementById("artist-jsonld");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "artist-jsonld";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}
