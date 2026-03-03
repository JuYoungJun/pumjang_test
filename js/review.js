/* =========================================================
  리뷰 JSON을 읽어서 렌더링
  - 갤러리형 / 목록형 토글
  - 상세보기: grid/list 모두 동일 모달
  ✅ 별점 있는 플랫폼은 4점/5점만 노출 (소숫점 없음)
========================================================= */

const REVIEW_JSON_FILES = [
    { key: "smartstore", label: "네이버 스마트스토어", crawledFrom: "네이버 스마트스토어", url: "json/naver_smartstore.json", hasRating: true },
    { key: "naver_map", label: "네이버지도", crawledFrom: "네이버지도", url: "json/naver_map.json", hasRating: false },
    { key: "kakao_map", label: "카카오지도", crawledFrom: "카카오지도", url: "json/kakao_map.json", hasRating: true },
];

const DEFAULT_THUMB = "assets/img/review/thumb.webp";
const DEFAULT_AVATAR = "assets/img/review/profile.webp";

let REVIEWS = [];

/* ✅ STATE */
const PAGE_SIZE = 16;
const PAGER_WINDOW = 5;
const state = { page: 1, q: "", sort: "rating", view: "grid" };

/* DOM */
function $(id) { return document.getElementById(id); }

/* ================= UTIL ================= */
function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function firstText(...vals) {
    for (const v of vals) {
        const t = String(v ?? "").trim();
        if (t) return t;
    }
    return "";
}

function normalizeDateText(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return s;
    return `${m[1]}.${Number(m[2])}.${Number(m[3])}`;
}

function starsFor(rating) {
    const full = Math.round(Number(rating || 0));
    const empty = 5 - full;
    return ("★".repeat(full) + "☆".repeat(empty)).slice(0, 5);
}

/* ✅ 유효성 + 별점 필터(4/5점만) */
function isValidReview(r) {
    if (!r) return false;

    const c = String(r.content ?? "").trim();
    if (c.length < 2) return false;

    // ⭐ 별점 있는 플랫폼만 4점 또는 5점만 허용 (소숫점 없음)
    if (r.hasRating) {
        const rating = Number(r.rating || 0);
        if (rating !== 4 && rating !== 5) return false;
    }

    return true;
}

function resolveThumb(thumb) {
    const t = String(thumb ?? "").trim();
    return t || DEFAULT_THUMB || "";
}

function resolveAvatar(url) {
    const t = String(url ?? "").trim();
    return t || DEFAULT_AVATAR || "";
}

function truncate(text, max) {
    const t = String(text ?? "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    return t.slice(0, max) + "…";
}

function dateToNum(dateStr) {
    const s = String(dateStr ?? "").trim();
    const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return 0;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return y * 10000 + mo * 100 + d;
}

function filterReviews(list, q) {
    let out = list.filter(isValidReview);
    const query = (q || "").trim().toLowerCase();
    if (!query) return out;

    return out.filter(x =>
        (x.title || "").toLowerCase().includes(query) ||
        (x.content || "").toLowerCase().includes(query) ||
        (x.author || "").toLowerCase().includes(query) ||
        (x.sourceLabel || "").toLowerCase().includes(query)
    );
}

/* ✅ 정렬 (별점순/최신순) */
function sortReviews(list, sortKey) {
    const out = [...list];

    if (sortKey === "recent") {
        out.sort((a, b) => {
            const d = dateToNum(b.date) - dateToNum(a.date);
            if (d !== 0) return d;
            return (a._rand ?? 0) - (b._rand ?? 0);
        });
        return out;
    }

    out.sort((a, b) => {
        const r = Number(b.rating || 0) - Number(a.rating || 0);
        if (r !== 0) return r;
        return (a._rand ?? 0) - (b._rand ?? 0);
    });
    return out;
}

function paginate(list, page, size) {
    const totalPages = Math.max(1, Math.ceil(list.length / size));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * size;
    return { items: list.slice(start, start + size), page: safePage, totalPages };
}

/* ================= UI builders ================= */
function galleryCardHTML(r) {
    const thumb = resolveThumb(r.thumb);
    const rating = Number(r.rating || 0);
    const title = truncate(r.content || r.title || "후기", 34);
    const desc = truncate(r.content || "", 64);

    return `
    <article class="g-card" aria-label="리뷰 카드" role="button" tabindex="0" data-review-id="${escapeHtml(r.id)}">
      <div class="g-thumb">
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ""}
      </div>
      <div class="g-body">
        <div class="g-title">${escapeHtml(title)}</div>
        <div class="g-desc">${escapeHtml(desc)}</div>
        <div class="g-foot">
          <div class="g-date">${escapeHtml(r.date || "")}</div>
          ${r.hasRating && rating ? `<div class="g-stars" aria-label="별점">${escapeHtml(starsFor(rating))}</div>` : `<div></div>`}
        </div>
      </div>
    </article>
  `;
}

/* ✅ 목록형: 클릭하면 모달 열기(아코디언 제거) */
function listItemHTML(r) {
    const thumb = resolveThumb(r.thumb);
    const rating = Number(r.rating || 0);
    const avatar = resolveAvatar(r.profileImageUrl);
    const hasRating = r.hasRating && rating;

    const preview = truncate(r.content || r.title || "", 120);

    return `
    <article class="l-item" aria-label="리뷰 항목" role="button" tabindex="0" data-review-id="${escapeHtml(r.id)}">
      <div class="l-avatar" aria-hidden="true">
        <img src="${escapeHtml(avatar)}" alt="" loading="lazy" onerror="this.onerror=null; this.src='${escapeHtml(DEFAULT_AVATAR)}';">
      </div>

      <div class="l-main">
        <div class="l-author">${escapeHtml(r.author || "익명")}</div>
        <div class="l-sub">
          ${r.sourceLabel ? `<span>${escapeHtml(r.sourceLabel)}</span>` : ""}
          ${(r.sourceLabel && r.date) ? `<span>|</span>` : ""}
          ${r.date ? `<span>${escapeHtml(r.date)}</span>` : ""}
          ${hasRating ? `<span class="l-stars" aria-label="별점">${escapeHtml(starsFor(rating))}</span>` : ""}
        </div>
        <div class="l-text">${escapeHtml(preview)}</div>
      </div>

      <div class="l-thumb">
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ""}
      </div>
    </article>
  `;
}

/* ================= PAGER ================= */
function renderPager(el, page, totalPages) {
    if (!el) return;

    const btn = (label, disabled, act, cls = "", pageNum = null) =>
        `<button class="${cls}" ${disabled ? "disabled" : ""} data-act="${act}" ${pageNum != null ? `data-page="${pageNum}"` : ""}>${label}</button>`;

    let html = "";
    html += btn("«", page <= 1, "first");
    html += btn("‹", page <= 1, "prev");

    const half = Math.floor(PAGER_WINDOW / 2);
    let start = Math.max(1, page - half);
    let end = start + PAGER_WINDOW - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - PAGER_WINDOW + 1); }

    for (let i = start; i <= end; i++) {
        html += btn(String(i), false, "page", i === page ? "active" : "", i);
    }

    html += btn("›", page >= totalPages, "next");
    html += btn("»", page >= totalPages, "last");

    el.innerHTML = html;
}

/* ================= RENDER ================= */
function syncViewUI() {
    const gridEl = $("reviewGrid");
    const listEl = $("reviewList");
    const btnGrid = $("btnGrid");
    const btnList = $("btnList");

    if (btnGrid && btnList) {
        btnGrid.classList.toggle("is-active", state.view === "grid");
        btnList.classList.toggle("is-active", state.view === "list");
    }
    if (gridEl && listEl) {
        gridEl.style.display = (state.view === "grid") ? "" : "none";
        listEl.style.display = (state.view === "list") ? "" : "none";
    }
}

function render() {
    const gridEl = $("reviewGrid");
    const listEl = $("reviewList");
    const pager = $("pager");
    const empty = $("emptyState");
    if (!gridEl || !listEl || !pager || !empty) return;

    syncViewUI();

    const filtered = filterReviews(REVIEWS, state.q);
    const sorted = sortReviews(filtered, state.sort);

    if (!sorted.length) {
        gridEl.innerHTML = "";
        listEl.innerHTML = "";
        pager.innerHTML = "";
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    const p = paginate(sorted, state.page, PAGE_SIZE);
    state.page = p.page;

    if (state.view === "grid") {
        gridEl.innerHTML = p.items.map(galleryCardHTML).join("");
        listEl.innerHTML = "";
    } else {
        listEl.innerHTML = p.items.map(listItemHTML).join("");
        gridEl.innerHTML = "";
    }

    renderPager(pager, p.page, p.totalPages);
}

/* ================= JSON LOAD + NORMALIZE ================= */
async function fetchJsonArray(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} 로드 실패 (${res.status})`);
    const json = await res.json();

    const arr =
        Array.isArray(json) ? json :
            Array.isArray(json.data) ? json.data :
                Array.isArray(json.reviews) ? json.reviews :
                    Array.isArray(json.items) ? json.items :
                        [];

    if (!Array.isArray(arr)) throw new Error(`${url} JSON 구조가 배열이 아닙니다.`);
    return arr;
}

function normalizeSmartstore(item, cfg, idx) {
    const rawDate = firstText(
        item.date, item.review_date, item.reviewDate,
        item.created_at, item.createdAt,
        item.written_at, item.writtenAt
    );

    return {
        id: item.index != null ? `smartstore-${item.index}` : `smartstore-${idx}`,
        source: cfg.key,
        sourceLabel: cfg.label,
        crawledFrom: cfg.crawledFrom,
        hasRating: cfg.hasRating,

        rating: Number(item.score ?? item.rating ?? 0) || 0,
        date: normalizeDateText(rawDate),
        author: item.user ?? item.nickname ?? item.writer ?? "익명",
        title: item.title ?? "후기",
        content: item.content ?? item.text ?? item.body ?? "",

        thumb: item.image_url ?? (Array.isArray(item.image_urls) ? item.image_urls[0] : "") ?? "",
        url: "#",
        profileImageUrl: item.profile_image_url ?? item.profileImageUrl ?? item.profile ?? "",
        _rand: Math.random(),
    };
}

function normalizeGeneric(item, cfg, idx) {
    const rawDate = firstText(
        item.visit_date, item.visited_date, item.visitedDate,
        item.date, item.review_date, item.reviewDate,
        item.created_at, item.createdAt,
        item.written_at, item.writtenAt,
        item.reg_date, item.regDate,
        item.time, item.timestamp
    );

    return {
        id: item.id != null ? `${cfg.key}-${item.id}` : `${cfg.key}-${idx}`,
        source: cfg.key,
        sourceLabel: item.sourceLabel ?? cfg.label,
        crawledFrom: item.crawledFrom ?? cfg.crawledFrom,
        hasRating: cfg.hasRating,

        rating: Number(item.rating ?? item.score ?? item.star ?? 0) || 0,
        date: normalizeDateText(rawDate),
        author: item.nickname ?? item.author ?? item.user ?? item.writer ?? "익명",
        title: item.title ?? item.summary ?? "후기",
        content: item.content ?? item.text ?? item.body ?? "",

        thumb: item.thumb ?? item.image_url ?? item.imageUrl ?? item.thumbnail ?? "",
        url: "#",
        profileImageUrl: item.profile_image_url ?? item.profileImageUrl ?? item.profile ?? "",
        _rand: Math.random(),
    };
}

async function loadAllReviews() {
    const results = await Promise.allSettled(
        REVIEW_JSON_FILES.map(async (cfg) => {
            const arr = await fetchJsonArray(cfg.url);
            if (cfg.key === "smartstore") return arr.map((x, i) => normalizeSmartstore(x, cfg, i));
            return arr.map((x, i) => normalizeGeneric(x, cfg, i));
        })
    );

    const merged = [];
    const errors = [];

    results.forEach((r, idx) => {
        const cfg = REVIEW_JSON_FILES[idx];
        if (r.status === "fulfilled") merged.push(...r.value);
        else errors.push(`${cfg.url} → ${r.reason?.message || r.reason}`);
    });

    if (errors.length) console.warn("❌ 리뷰 JSON 일부 로드 실패:", errors);

    // ✅ 여기서도 한 번 더 필터링(4/5점 + content)
    REVIEWS = merged.filter(isValidReview);
}

/* ================= MODAL ================= */
function getReviewById(id) {
    return REVIEWS.find(r => String(r.id) === String(id)) || null;
}

function openReviewModal(id) {
    const r = getReviewById(id);
    if (!r) return;

    const modal = $("reviewModal");
    const imgEl = $("modalImg");
    const leftEl = modal ? modal.querySelector(".modal__left") : null;

    const avatarEl = $("modalAvatar");
    const authorEl = $("modalAuthor");
    const sourceEl = $("modalSource");
    const dateEl = $("modalDate");
    const starsEl = $("modalStars");
    const scoreEl = $("modalScore");
    const textEl = $("modalText");

    if (!modal || !imgEl || !avatarEl || !authorEl || !sourceEl || !dateEl || !starsEl || !scoreEl || !textEl) return;

    // ✅ 좌측 이미지(thumb 없거나 깨져도 DEFAULT_THUMB 나오게)
    const rawThumb = String(r.thumb ?? "").trim();
    const finalThumb = rawThumb ? resolveThumb(rawThumb) : DEFAULT_THUMB;

    imgEl.src = finalThumb;
    imgEl.style.display = "";
    leftEl && leftEl.classList.remove("is-empty");

    // 이미지 로드 실패 시 기본 썸네일로
    imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = DEFAULT_THUMB;
        imgEl.style.display = "";
        leftEl && leftEl.classList.remove("is-empty");
    };

    // 프로필/메타
    const avatar = resolveAvatar(r.profileImageUrl);
    avatarEl.src = avatar;
    avatarEl.onerror = () => { avatarEl.src = DEFAULT_AVATAR; };

    authorEl.textContent = r.author || "익명";
    sourceEl.textContent = r.sourceLabel ? r.sourceLabel : "";
    dateEl.textContent = r.date ? r.date : "";

    // 별점
    const rating = Number(r.rating || 0);
    const showRating = (r.hasRating && rating);
    starsEl.textContent = showRating ? starsFor(rating) : "";
    // ✅ 소숫점 안쓴다 하셔서 정수로 표시
    scoreEl.textContent = showRating ? `${Math.round(rating)}` : "";

    // 본문
    textEl.textContent = (r.content || r.title || "").trim();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";

    const panel = modal.querySelector(".modal__panel");
    panel && panel.focus();
}

function closeReviewModal() {
    const modal = $("reviewModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
}

/* ================= EVENTS ================= */
function bindEvents() {
    // 닫기
    document.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.closest && t.closest("[data-modal-close]")) closeReviewModal();
    });

    // 카드 클릭: grid/list 모두 모달
    document.addEventListener("click", (e) => {
        const card = e.target && e.target.closest ? e.target.closest("[data-review-id]") : null;
        if (!card) return;
        if (card.closest(".pager")) return;

        const id = card.getAttribute("data-review-id");
        if (id) openReviewModal(id);
    });

    // 키보드
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const el = document.activeElement;
        if (!el || !el.getAttribute) return;

        const id = el.getAttribute("data-review-id");
        if (!id) return;

        e.preventDefault();
        openReviewModal(id);
    });

    // ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeReviewModal();
    });
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();

    const searchInput = $("searchInput");
    const pager = $("pager");
    const btnGrid = $("btnGrid");
    const btnList = $("btnList");
    const gridEl = $("reviewGrid");
    const listEl = $("reviewList");

    if (btnGrid) {
        btnGrid.addEventListener("click", () => {
            state.view = "grid";
            state.page = 1;
            render();
        });
    }

    if (btnList) {
        btnList.addEventListener("click", () => {
            state.view = "list";
            state.page = 1;
            render();
        });
    }

    document.querySelectorAll('input[name="sort"]').forEach((el) => {
        el.addEventListener("change", (e) => {
            state.sort = e.target.value;
            state.page = 1;
            render();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            state.q = e.target.value;
            state.page = 1;
            render();
        });
    }

    if (pager) {
        pager.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-act]");
            if (!b || b.disabled) return;

            const act = b.dataset.act;
            const filtered = filterReviews(REVIEWS, state.q);
            const sorted = sortReviews(filtered, state.sort);
            const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

            if (act === "first") state.page = 1;
            else if (act === "prev") state.page = Math.max(1, state.page - 1);
            else if (act === "next") state.page = Math.min(totalPages, state.page + 1);
            else if (act === "last") state.page = totalPages;
            else if (act === "page") state.page = Number(b.dataset.page || state.page);

            render();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    if (gridEl) gridEl.innerHTML = `<div class="empty">리뷰 데이터를 불러오는 중입니다...</div>`;
    if (listEl) listEl.innerHTML = "";

    try {
        await loadAllReviews();
    } catch (err) {
        console.error("❌ loadAllReviews 실패:", err);
        REVIEWS = [];
    }

    render();
});

// ✅ REVIEW 페이지에서만 nav 햄버거 동작 바인딩 (include.js 수정 없이)
document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".nav-toggle");
    if (!btn) return;

    if (typeof window.toggleNav === "function") window.toggleNav();

    const navMenu = document.getElementById("navMenu");
    if (navMenu) btn.setAttribute("aria-expanded", String(navMenu.classList.contains("active")));
});