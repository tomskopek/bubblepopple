function getQueryParam(name) {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  return urlParams.get(name);
}

function seededRandom(seed) {
  var x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

let seed = +getQueryParam("seed") || Math.random();

function randomInt(min, max) {
  const random = seededRandom(+seed);
  seed += 1
  return Math.floor(random * (max - min + 1)) + min;
}

export { getQueryParam, seededRandom, randomInt };

