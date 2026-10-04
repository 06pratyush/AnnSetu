// Plain module (no "use client") so the root layout, a server component, can inline it.
export const THEME_STORAGE_KEY = "annsetu.theme";

/** Runs before paint so a saved theme or language never flashes the wrong one. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);var l=localStorage.getItem("annsetu.lang");if(l==="hi"||l==="en")document.documentElement.lang=l}catch(e){}`;
