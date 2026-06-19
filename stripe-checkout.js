const checkoutLinks = document.querySelectorAll("[data-checkout-product]");

checkoutLinks.forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();

    if (link.getAttribute("aria-busy") === "true") {
      return;
    }

    const product = link.dataset.checkoutProduct;
    link.setAttribute("aria-busy", "true");

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.assign(data.url);
    } catch (error) {
      alert(error.message);
      link.removeAttribute("aria-busy");
    }
  });
});
