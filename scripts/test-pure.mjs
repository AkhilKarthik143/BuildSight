// Pure helpers: json, catalog query, where-am-I decide, upload titles. No network.
import { categoriesOf, matches, metaLine, mixed, toResult } from "../src/lib/catalogQuery.ts";
import { firstJsonObject } from "../src/lib/json.ts";
import { uploadTitle } from "../src/lib/uploadTitle.ts";
import { AUTO_MIN_CONFIDENCE, decide } from "../src/lib/whereAmIDecide.ts";

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

const obj = firstJsonObject('note {"a":1} tail {"b":2}');
check("first JSON object wins", obj && obj.a === 1 && obj.b === undefined);
check("code fence", firstJsonObject("```json\n{\"ok\":true}\n```")?.ok === true);
check("brace inside a string", firstJsonObject('{"s":"a { b }"}')?.s === "a { b }");
check("skips a broken object", firstJsonObject("{nope} {\"ok\":1}")?.ok === 1);
check("no object", firstJsonObject("I must refuse.") === null);

const item = (over) => ({
  id: "1",
  source: "lego",
  name: "Playful Cat",
  category: "Creator",
  image: "/cover.png",
  manuals: [{ label: "Book 1", pdfPath: "/manual-pdf/lego/1.pdf", size: "A4" }],
  set: "31163",
  pieces: 1657,
  age: "9+",
  ...over,
});

check("matches every word", matches(item(), "cat 31163"));
check("misses a word", !matches(item(), "cat dog"));
const ikea = item({ source: "ikea", name: "KALLAX", category: "Storage", itemNo: "80275887", set: undefined, manuals: [{ label: "A", pdfPath: "/a.pdf" }, { label: "B", pdfPath: "/b.pdf" }] });
check("ikea item number", matches(ikea, "80275887"));
check("lego meta", metaLine(item()) === "#31163 · 1,657 pcs · 9+");
check("ikea meta", metaLine(ikea) === "2 manuals");
const one = toResult(item(), item().manuals[0]);
check("single manual subtitle", one.subtitle === "LEGO 31163" && one.pdfPath.endsWith("1.pdf") && one.sizeLabel === "A4");
check("multi manual subtitle", toResult(ikea, ikea.manuals[0]).subtitle === "IKEA 80275887 · A");

const catalog = [
  item({ id: "f", name: "Featured", featured: true, category: "City" }),
  item({ id: "c1", name: "A", category: "Creator" }),
  item({ id: "t1", name: "B", category: "Technic" }),
  item({ id: "c2", name: "C", category: "Creator" }),
  item({ id: "z", name: "Zed", category: "Zzz" }),
];
check("category order", categoriesOf(catalog).join(",") === "Creator,City,Technic,Zzz");
const order = mixed(catalog).map((i) => i.id);
check("featured first then interleaved", order.join(",") === "f,c1,t1,z,c2");

const tiles = [
  { tile: 1, page: 1, number: 1, image: "a" },
  { tile: 2, page: 1, number: 2, image: "b" },
  { tile: 3, page: 2, number: 1, image: "c" },
];
const low = decide({ completed_tile: 2, confidence: 0.1, broken: [] }, tiles, true, undefined, AUTO_MIN_CONFIDENCE);
check("below auto confidence stays unsure", low.action === "unsure");
const fix = decide(
  { completed_tile: 2, confidence: 0.8, broken: [{ tile: 1, part: "red 2x4", problem: "rotated", fix: "Turn it." }, { tile: 9, part: "ghost", problem: "x", fix: "y" }] },
  tiles,
  true,
);
check("broken earlier step wins", fix.action === "fix" && fix.target.number === 1 && fix.problems.length === 1 && fix.say.includes("step 1"));
const weak = decide({ completed_tile: 1, confidence: 0.5, broken: [{ tile: 1, part: "red", problem: "missing", fix: "Add it." }] }, tiles, true);
check("weak broken claim moves on", weak.action === "goto" && weak.target.tile === 2);
const stay = decide({ completed_tile: 1, confidence: 0.9, broken: [] }, tiles, true, { page: 1, number: 2 });
check("already there", stay.action === "stay");
const start = decide({ completed_tile: 0, confidence: 0.9, broken: [] }, tiles, false);
check("nothing built", start.action === "goto" && start.say.includes("nothing's built"));
const done = decide({ completed_tile: 3, confidence: 0.9, broken: [] }, tiles, true);
check("last step done", done.action === "done");
const mid = decide({ completed_tile: 3, confidence: 0.9, broken: [] }, tiles, false);
check("book still loading", mid.action === "unsure" && mid.say.includes("still reading"));

check("upload title", uploadTitle("Playful-Cat_v2.PDF") === "Playful Cat v2");
check("upload title without extension", uploadTitle("notes") === "notes");

console.log(`\n${failed === 0 ? "pure lib tests passed" : `${failed} failed`}`);
if (failed) process.exit(1);
