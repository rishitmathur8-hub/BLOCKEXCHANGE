// Where the FastAPI backend is running.
// Start it from the backend folder with:  uvicorn app.main:app --reload
const API_BASE = "http://127.0.0.1:8000";

async function getJSON(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) {
    throw new Error(path + " returned status " + res.status);
  }
  return res.json();
}

// Loads everything the page needs, in parallel.
//   GET /trains    -> TrainOut[]
//   GET /requests  -> RequestOut[]  (only requests not merged into a block yet)
//   GET /blocks    -> BlockOut[]    (each block includes its merged requests)
function fetchAll() {
  return Promise.all([
    getJSON("/trains"),
    getJSON("/requests"),
    getJSON("/blocks"),
  ]).then(([trains, requests, blocks]) => ({ trains, requests, blocks }));
}