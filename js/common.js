// // common.js
// async function loadPartial(id, url) {
//   const el = document.getElementById(id);
//   if (!el) return;

//   const res = await fetch(url, { cache: "no-cache" });
//   el.innerHTML = await res.text();
// }

// /**
//  * nav 토글 + 현재 메뉴 active 처리
//  * - include(nav.html)로 들어오는 구조(.nav-toggle, #navMenu)
//  * - index 전용(#landingHamburger, #navMenu)도 있으면 같이 지원
//  */
// function setupNav() {
//   const menu = document.getElementById("navMenu");
//   if (!menu) return;

//   // 1) 공통 nav.html 햄버거 버튼
//   const toggleBtn =
//     document.getElementById("navToggle") || document.querySelector(".nav-toggle");

//   // 2) index.html 전용 햄버거(있으면)
//   const landingHamburger = document.getElementById("landingHamburger");

//   const toggleMenu = () => {
//     menu.classList.toggle("active");
//     const expanded = menu.classList.contains("active");

//     if (toggleBtn) toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
//     if (landingHamburger) landingHamburger.setAttribute("aria-expanded", expanded ? "true" : "false");
//   };

//   // ✅ 중복 바인딩 방지
//   if (toggleBtn && !toggleBtn.dataset.bound) {
//     toggleBtn.addEventListener("click", toggleMenu);
//     toggleBtn.dataset.bound = "1";
//   }

//   if (landingHamburger && !landingHamburger.dataset.bound) {
//     landingHamburger.addEventListener("click", toggleMenu);
//     landingHamburger.addEventListener("keydown", (e) => {
//       if (e.key === "Enter" || e.key === " ") toggleMenu();
//     });
//     landingHamburger.dataset.bound = "1";
//   }

//   // ✅ 메뉴 클릭 시 모바일에서 닫기(UX)
//   menu.querySelectorAll("a").forEach((a) => {
//     if (a.dataset.bound) return;
//     a.addEventListener("click", () => {
//       menu.classList.remove("active");
//       if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
//       if (landingHamburger) landingHamburger.setAttribute("aria-expanded", "false");
//     });
//     a.dataset.bound = "1";
//   });

//   // ✅ 현재 페이지에 맞는 메뉴 active 자동 처리
//   const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

//   // 전체 a에서 active 제거
//   document.querySelectorAll(".nav-menu a").forEach((a) => a.classList.remove("active"));

//   // 내부 링크만 비교해서 active
//   document.querySelectorAll(".nav-menu a[href]").forEach((a) => {
//     const href = (a.getAttribute("href") || "").toLowerCase();
//     if (!href || href.startsWith("http")) return;
//     if (href === path) a.classList.add("active");
//   });
// }

// async function initLayout() {
//   // ✅ index.html이 include 방식을 안 쓰면(site-nav가 없으면) 그냥 스킵됩니다.
//   await loadPartial("site-nav", "nav.html");
//   await loadPartial("site-footer", "footer.html");

//   // ✅ include가 끝난 뒤 바인딩
//   setupNav();
// }

// document.addEventListener("DOMContentLoaded", initLayout);

async function includeHTML(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(url);
  el.innerHTML = await res.text();

  // ✅ include 끝난 뒤: nav 토글 연결
  bindNavToggle();
}

function bindNavToggle() {
  const navMenu = document.getElementById("navMenu");
  if (!navMenu) return;

  // 1) 공통 nav.html 버튼
  const navToggleBtn = document.getElementById("navToggle") || document.querySelector(".nav-toggle");

  // 2) index 전용 햄버거
  const landingHamburger = document.getElementById("landingHamburger");

  const toggle = () => {
    const opened = navMenu.classList.toggle("active");

    // aria-expanded 처리(있을 때만)
    if (navToggleBtn) navToggleBtn.setAttribute("aria-expanded", opened ? "true" : "false");
    if (landingHamburger) landingHamburger.setAttribute("aria-expanded", opened ? "true" : "false");
  };

  // ✅ 중복 바인딩 방지(여러번 include될 때 대비)
  if (navToggleBtn && !navToggleBtn.dataset.bound) {
    navToggleBtn.addEventListener("click", toggle);
    navToggleBtn.dataset.bound = "1";
  }

  if (landingHamburger && !landingHamburger.dataset.bound) {
    landingHamburger.addEventListener("click", toggle);
    landingHamburger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") toggle();
    });
    landingHamburger.dataset.bound = "1";
  }

  // ✅ 메뉴 클릭하면 닫기(모바일 UX)
  navMenu.querySelectorAll("a").forEach(a => {
    if (a.dataset.bound) return;
    a.addEventListener("click", () => {
      navMenu.classList.remove("active");
      if (navToggleBtn) navToggleBtn.setAttribute("aria-expanded", "false");
      if (landingHamburger) landingHamburger.setAttribute("aria-expanded", "false");
    });
    a.dataset.bound = "1";
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // 공통 include가 있는 페이지에서만 실행
  includeHTML("#include-nav", "nav.html");
  includeHTML("#include-footer", "footer.html");

  // ✅ index 처럼 include가 없는 페이지도 대비해서 한 번 바인딩
  bindNavToggle();
});
