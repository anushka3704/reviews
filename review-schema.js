// connecting an app to Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class ReviewSchemaManager {
  constructor() {
    // main container where all reviews will be rendered
    this.container = document.getElementById("reviews-container");

    // if container is not present, stop execution
    if (!this.container) return;

    // firebase configuration (you will fill actual keys)
    this.firebaseConfig = {
      apiKey: "",
      authDomain: "",
      projectId: ""
    };

    // initialize firebase app and firestore database
    this.app = initializeApp(this.firebaseConfig);
    this.db = getFirestore(this.app);

    // name used in schema (for SEO)
    this.productName = "product";

    // start async flow
    this.asyncInit();
  }

  async asyncInit() {
    // if database is not initialized, stop
    if (!this.db) return;

    // fetch all reviews from firestore
    let reviews = await this.fetchReviews();

    // separate AI review from normal reviews
    let aiReview = reviews.find(r => r.type === "ai");
    let normalReviews = reviews.filter(r => r.type !== "ai");

    // sort normal reviews by latest date first
    normalReviews = this.sortReviewsByDate(normalReviews);

    // if AI review exists, keep it at top
    reviews = aiReview ? [aiReview, ...normalReviews] : normalReviews;

    // total reviews count (excluding AI)
    const totalReviews = normalReviews.length;

    // render top banner like "Excellent on Google"
    this.renderTopRating(aiReview, totalReviews);

    // if no reviews, stop further execution
    if (!reviews.length) return;

    // create structured data (for SEO / Google rich results)
    this.createReviewSchema(reviews);

    // render all reviews on UI
    this.renderReviews(reviews);
  }

  async fetchReviews() {
    try {
      // fetch documents from "reviews" collection
      const querySnapshot = await getDocs(collection(this.db, "reviews"));
      const reviews = [];

      // push each document data into array
      querySnapshot.forEach((doc) => {
        reviews.push(doc.data());
      });

      return reviews;
    } catch (error) {
      // log error and return empty array so UI doesn't break
      console.error("Error fetching reviews:", error);
      return [];
    }
  }

  processReviews(reviews) {
    // total number of reviews
    const totalReviews = reviews.length;

    // sum of all ratings
    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);

    // calculate average rating safely
    const avgRating = totalReviews
      ? (totalRating / totalReviews).toFixed(1)
      : 0;

    return { totalReviews, avgRating };
  }

  sortReviewsByDate(reviews) {
    // sort reviews from latest to oldest
    return reviews.sort((a, b) => {
      // handle firestore timestamp and normal date
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);

      return dateB - dateA;
    });
  }

  createReviewSchema(reviews) {
    // if no reviews, no need to create schema
    if (!reviews.length) return;

    // calculate rating stats
    const { totalReviews, avgRating } = this.processReviews(reviews);

    // schema structure for Google SEO
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

    // inject schema into page head
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schemaData);

    document.head.appendChild(script);
  }

  renderReviews(reviews) {
    // clear previous content before rendering again
    this.container.innerHTML = "";

    reviews.forEach((r) => {

      // ---------- AI REVIEW CARD ----------
      if (r.type === "ai") {
        const div = document.createElement("div");
        div.className = "review-card ai-card";

        // splitting text into bullet-like points using "*"
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

      // ---------- NORMAL REVIEW CARD ----------
      const div = document.createElement("div");
      div.className = "review-card";

      // fallback values if data is missing
      const name = r.author || "Anonymous";
      const stars = r.rating || 5;
      const text = r.text || "";

      /* 
        handle review photos properly
        sometimes it's already an array
        sometimes it's stored as stringified JSON
      */
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

      // generate HTML only if photos exist
      const photosHTML = photos.length
        ? `<div class="review-photos">
            ${photos.map(p => `
              <img src="${p}" class="review-photo" loading="lazy"/>
            `).join("")}
          </div>`
        : "";

      // default fallback date
      let date = "Recently";

      // convert timestamp into "x days ago" format
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

      // simple star UI using characters
      const starUI = "★".repeat(stars) + "☆".repeat(5 - stars);

      // profile photo or fallback avatar
      const avatar = r.profile_photo
        ? `<img src="${r.profile_photo}" class="review-avatar-img" />`
        : `<div class="review-avatar">${name.charAt(0).toUpperCase()}</div>`;

      // main card structure
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

    // after rendering, enable image click viewer
    this.initPhotoViewer();
  }

  initPhotoViewer() {
    let modal = document.getElementById("photo-modal");

    // create modal only once if it doesn't exist
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "photo-modal";

      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <span class="modal-close">&times;</span>
        <img class="modal-img" />
      `;

      document.body.appendChild(modal);

      // close modal when clicking overlay or close button
      modal.addEventListener("click", (e) => {
        if (
          e.target.classList.contains("modal-overlay") ||
          e.target.classList.contains("modal-close")
        ) {
          modal.classList.remove("active");
        }
      });
    }

    // event delegation for all review images
    this.container.addEventListener("click", (e) => {
      if (e.target.classList.contains("review-photo")) {
        modal.querySelector(".modal-img").src = e.target.src;
        modal.classList.add("active");
      }
    });
  }

  renderTopRating(aiReview, totalReviews) {
    // if no AI review, skip banner
    if (!aiReview) return;

    // get rating and total safely
    const rating = parseFloat(aiReview.avgRating ?? aiReview.rating ?? 4.8);
    const total = aiReview?.totalReviews ?? totalReviews ?? 0;

    // star display
    const stars = "★".repeat(Math.floor(rating)) + "☆".repeat(5 - Math.floor(rating));

    const banner = document.createElement("div");
    banner.className = "top-rating-banner";

    // top rating UI (Google style)
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

    // remove old banner if already exists
    const existing = document.querySelector(".top-rating-banner");
    if (existing) existing.remove();

    // insert banner above reviews container
    this.container.parentElement.insertBefore(banner, this.container);
  }
}

// run after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ReviewSchemaManager();
});
