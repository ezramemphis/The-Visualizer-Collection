const menuItems = document.querySelectorAll(".menu li");

const previewPanel = document.getElementById("previewPanel");
const previewFrame = document.getElementById("previewFrame");

let hoverTimer = null;

menuItems.forEach(item => {

  item.addEventListener("mouseenter", () => {

    const target = item.dataset.target;

    hoverTimer = setTimeout(() => {

      previewFrame.src = target + "?preview=true";
      previewPanel.classList.add("show");

    }, 800); // 0.8 second delay

  });

  item.addEventListener("mouseleave", () => {

    clearTimeout(hoverTimer);

    previewPanel.classList.remove("show");

  });

});