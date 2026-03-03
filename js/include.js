
async function includeHTML(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;

    const res = await fetch(url);
    el.innerHTML = await res.text();

    // include 된 nav의 토글 버튼 동작 연결(공통)
    window.toggleNav = function () {
        const navMenu = document.getElementById("navMenu");
        if (navMenu) navMenu.classList.toggle("active");
    };
}

// 페이지 로드시 include 실행
window.addEventListener("DOMContentLoaded", () => {
    includeHTML("#include-nav", "nav.html");
    includeHTML("#include-footer", "footer.html");
});
