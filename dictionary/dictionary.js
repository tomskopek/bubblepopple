// Credit:
// http://ejohn.org/blog/dictionary-lookups-in-javascript/
// http://ejohn.org/blog/javascript-trie-performance-analysis/
// http://ejohn.org/blog/revised-javascript-dictionary-search/
// http://stevehanov.ca/blog/index.php?id=120

let dict;
import { FrozenTrie } from "./Bits.js";

export function buildDict() {
  let txt = "";
  const rawFile = new XMLHttpRequest();
  rawFile.open("GET", "dictionary/succinct.txt", false);
  rawFile.onreadystatechange = function () {
    if (rawFile.readyState === 4) {
      if (rawFile.status === 200 || rawFile.status == 0) {
        txt = rawFile.responseText;
      }
    }
  };
  rawFile.send(null);
  buildSuccinctDict(txt);
}

function buildSuccinctDict(txt) {
  var parts = txt.split(",");

  return (dict = new FrozenTrie(parts[2], parts[1], parts[0]));
}

export function findSuccinctWord(word) {
  return dict.lookup(word);
}
