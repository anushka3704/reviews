// connecting an app to Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class ReviewSchemaManager {
  constructor() {
    this.container = document.getElementById("reviews-container");
    if (!this.container) return;

    this.firebaseConfig = {
      apiKey: "",
      authDomain: "",
      projectId: ""
    };

    this.app = initializeApp(this.firebaseConfig);
    this.db = getFirestore(this.app);
    this.productName = "product";

    this.asyncInit();
  }

  async asyncInit() {
    if (!this.db) return;

    let reviews = await this.fetchReviews();

    let aiReview = reviews.find(r => r.type === "ai");
    let normalReviews = reviews.filter(r => r.type !== "ai");

    normalReviews = this.sortReviewsByDate(normalReviews);
    reviews = aiReview ? [aiReview, ...normalReviews] : normalReviews;

    const totalReviews = normalReviews.length;

    this.renderTopRating(aiReview, totalReviews);

    if (!reviews.length) return;

    this.createReviewSchema(reviews);
    this.renderReviews(reviews);
  }

  async fetchReviews() {
    try {
      const querySnapshot = await getDocs(collection(this.db, "reviews"));
      const reviews = [];

      querySnapshot.forEach((doc) => {
        reviews.push(doc.data());
      });

      return reviews;
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }
  }

  processReviews(reviews) {
    const totalReviews = reviews.length;

    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);

    const avgRating = totalReviews
      ? (totalRating / totalReviews).toFixed(1)
      : 0;

    return { totalReviews, avgRating };
  }

  sortReviewsByDate(reviews) {
    return reviews.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
      return dateB - dateA;
    });
  }

  createReviewSchema(reviews) {
    if (!reviews.length) return;

    const { totalReviews, avgRating } = this.processReviews(reviews);

    const schemaData = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": this.productName || "Memeraki",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": avgRating,
        "reviewCount": totalReviews
      }
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schemaData);
    document.head.appendChild(script);
  }

  renderReviews(reviews) {
    this.container.innerHTML = "";

    reviews.forEach((r) => {

      // AI CARD
      if (r.type === "ai") {
        const div = document.createElement("div");
        div.className = "review-card ai-card";

        div.innerHTML = `
          <div class="ai-badge">✨ AI GENERATED</div>

          <div class="ai-header">
            <div class="ai-avatar">AI</div>
            <div>
              <div class="ai-title">Smart Summary</div>
              <div class="ai-subtitle">Based on all customer reviews</div>
            </div>
          </div>

          <div class="ai-divider"></div>

          <div class="ai-text">
            ${r.text
              .split("*")
              .filter(t => t.trim())
              .map(t => `<div class="ai-point">${t.trim()}</div>`)
              .join("")}
          </div>
        `;

        this.container.appendChild(div);
        return;
      }

      // NORMAL CARD
      const div = document.createElement("div");
      div.className = "review-card";

      const name = r.author || "Anonymous";
      const stars = r.rating || 5;
      const text = r.text || "";

      // FIXED PHOTO PARSING
      let photos = [];
      if (Array.isArray(r.review_photo)) {
        photos = r.review_photo;
      } else if (typeof r.review_photo === "string") {
        try {
          photos = JSON.parse(r.review_photo);
        } catch {
          photos = [];
        }
      }

      // FIXED photosHTML (MAIN BUG FIX)
      const photosHTML = photos.length
        ? `<div class="review-photos">
            ${photos.map(p => `
              <img src="${p}" class="review-photo" loading="lazy"/>
            `).join("")}
          </div>`
        : "";

      let date = "Recently";

      if (r.date?.toDate) {
        const diff = (new Date() - r.date.toDate()) / 1000;

        const days = Math.floor(diff / 86400);
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor(diff / 60);

        if (days > 0) date = `${days} day${days > 1 ? "s" : ""} ago`;
        else if (hours > 0) date = `${hours} hour${hours > 1 ? "s" : ""} ago`;
        else if (mins > 0) date = `${mins} minute${mins > 1 ? "s" : ""} ago`;
        else date = "Just now";
      }

      const starUI = "★".repeat(stars) + "☆".repeat(5 - stars);

      const avatar = r.profile_photo
        ? `<img src="${r.profile_photo}" class="review-avatar-img" />`
        : `<div class="review-avatar">${name.charAt(0).toUpperCase()}</div>`;

      div.innerHTML = `
        <div class="review-header">
          ${avatar}
          <div class="review-meta">
            <div class="review-author">${name}</div>
            <div class="review-date">${date}</div>
          </div>
        </div>

        <div class="review-rating">${starUI}</div>

        <div class="review-text">${text}</div>
        ${photosHTML}
      `;

      this.container.appendChild(div);
    });

    // IMPORTANT: enable photo click AFTER render
    this.initPhotoViewer();
  }

  initPhotoViewer() {
  let modal = document.getElementById("photo-modal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "photo-modal";
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <span class="modal-close">&times;</span>
      <img class="modal-img" />
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("modal-overlay") ||
        e.target.classList.contains("modal-close")
      ) {
        modal.classList.remove("active");
      }
    });
  }

  // INSIDE method (this is the fix)
  this.container.addEventListener("click", (e) => {
    if (e.target.classList.contains("review-photo")) {
      modal.querySelector(".modal-img").src = e.target.src;
      modal.classList.add("active");
    }
  });
}

  renderTopRating(aiReview, totalReviews) {
    if (!aiReview) return;

    const rating = parseFloat(aiReview.avgRating ?? aiReview.rating ?? 4.8);
    const total = aiReview?.totalReviews ?? totalReviews ?? 0;

    const stars = "★".repeat(Math.floor(rating)) + "☆".repeat(5 - Math.floor(rating));

    const banner = document.createElement("div");
    banner.className = "top-rating-banner";

    banner.innerHTML = `
      <div class="rating-left">
        <img src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png" class="google-icon"/>
        <div>
          <div class="rating-title">Excellent on Google</div>
          <div class="rating-stars">
            <span class="stars">${stars}</span>
            <span class="rating-value">${rating}</span>
            <span class="rating-text">out of 5 based on ${total} reviews</span>
          </div>
        </div>
      </div>
    `;

    const existing = document.querySelector(".top-rating-banner");
    if (existing) existing.remove();

    this.container.parentElement.insertBefore(banner, this.container);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ReviewSchemaManager();
});
