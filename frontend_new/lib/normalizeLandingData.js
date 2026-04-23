/**
 * Normalizes `/api/v1/landing/all` payloads so the landing UI works whether the
 * gateway serves the **admin** shape (`hero.slides`, string `about.images`) or the
 * **commerce** shape (`hero.images` with `{ url, device }`, object `about.images`).
 *
 * See: `services/admin/main.py` `get_public_landing_all` vs `services/commerce/main.py` `get_landing_all`.
 */

function pickUrl(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    return (
      item.url ||
      item.image_url ||
      item.image ||
      item.src ||
      ''
    ).trim();
  }
  return '';
}

function normalizeSlide(slide) {
  if (!slide || typeof slide !== 'object') return slide;
  const image =
    slide.image || slide.url || slide.desktop_url || slide.image_url || '';
  const imageMobile =
    slide.imageMobile ||
    slide.image_mobile ||
    slide.mobile_url ||
    slide.mobileImage ||
    image;
  return {
    ...slide,
    image,
    imageMobile,
    alt: slide.alt || slide.title || '',
  };
}

/**
 * Commerce stores hero as a flat `images[]` with per-row `device` / `device_variant`.
 * Approximate admin slide grouping: walk in order and merge mobile rows into the
 * current slide when possible, otherwise start a new slide.
 */
function heroImagesToSlides(images) {
  const rows = images
    .map((item) => {
      if (typeof item === 'string') {
        return { url: pickUrl(item), device: 'desktop', title: '' };
      }
      const url = pickUrl(item);
      const device = String(
        item.device || item.device_variant || 'desktop',
      ).toLowerCase();
      return {
        url,
        device: device === 'phone' ? 'mobile' : device,
        title: item.title || '',
      };
    })
    .filter((r) => r.url);

  if (rows.length === 0) return [];

  const slides = [];
  let cur = { image: null, imageMobile: null, alt: '' };

  const flush = () => {
    if (cur.image || cur.imageMobile) {
      const image = cur.image || cur.imageMobile;
      const imageMobile = cur.imageMobile || cur.image;
      slides.push(
        normalizeSlide({
          image,
          imageMobile,
          alt: cur.alt || '',
        }),
      );
    }
    cur = { image: null, imageMobile: null, alt: '' };
  };

  for (const row of rows) {
    const isMobile = row.device === 'mobile';
    if (isMobile) {
      if (cur.image && !cur.imageMobile) {
        cur.imageMobile = row.url;
        cur.alt = cur.alt || row.title;
      } else if (!cur.image && !cur.imageMobile) {
        cur.imageMobile = row.url;
        cur.alt = row.title;
      } else {
        flush();
        cur.imageMobile = row.url;
        cur.alt = row.title;
      }
    } else {
      if (cur.image || cur.imageMobile) {
        flush();
      }
      cur.image = row.url;
      cur.alt = row.title;
    }
  }
  flush();
  return slides;
}

function normalizeAboutImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      return pickUrl(item);
    })
    .filter(Boolean);
}

function normalizeProductImages(product) {
  const url =
    product.image_url ||
    product.primary_image ||
    product.primary_image_url ||
    product.image ||
    '';
  return { ...product, image_url: url, image: url };
}

function resolveCollectionLink(collection) {
  if (!collection || typeof collection !== 'object') return undefined;
  if (collection.slug) return `/collections/${collection.slug}`;
  if (collection.link) return collection.link;
  if (collection.id != null) return `/products?collection_id=${collection.id}`;
  return undefined;
}

export function normalizeLandingData(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  const data = { ...raw };

  if (data.hero && typeof data.hero === 'object') {
    const hero = { ...data.hero };
    const hasSlides = Array.isArray(hero.slides) && hero.slides.length > 0;
    const rawImages = Array.isArray(hero.images) ? hero.images : [];

    if (!hasSlides && rawImages.length > 0) {
      hero.slides = heroImagesToSlides(rawImages);
    }
    if (Array.isArray(hero.slides)) {
      hero.slides = hero.slides.map(normalizeSlide);
    }
    data.hero = hero;
  }

  if (data.about && typeof data.about === 'object') {
    data.about = {
      ...data.about,
      images: normalizeAboutImages(data.about.images),
    };
  }

  if (data.newArrivals?.products && Array.isArray(data.newArrivals.products)) {
    data.newArrivals = {
      ...data.newArrivals,
      products: data.newArrivals.products.map(normalizeProductImages),
    };
  }

  if (data.collections && typeof data.collections === 'object') {
    const col = { ...data.collections };
    const hasCategories =
      Array.isArray(col.categories) && col.categories.length > 0;
    const rawList = Array.isArray(col.collections) ? col.collections : [];
    if (!hasCategories && rawList.length > 0) {
      col.categories = rawList.map((c) => ({
        ...c,
        image: c.image || c.image_url,
        image_url: c.image_url || c.image,
        link: resolveCollectionLink(c),
      }));
    } else if (hasCategories) {
      col.categories = col.categories.map((c) => ({
        ...c,
        image: c.image || c.image_url,
        image_url: c.image_url || c.image,
        link: resolveCollectionLink(c),
      }));
    }
    data.collections = col;
  }

  return data;
}
