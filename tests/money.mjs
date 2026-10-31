import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const loadedModule = { exports: {} };
const compiled = ts.transpileModule(readFileSync("src/lib/money.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("module", "exports", compiled)(loadedModule, loadedModule.exports);
const { rublesInputToMinor, balanceToMinor } = loadedModule.exports;
for (const [input, expected] of [["50", 5000], ["25,50", 2550], ["0.01", 1], [" 100,5 ", 10050], ["0,29", 29]]) assert.equal(rublesInputToMinor(input), expected);
for (const input of ["", "0", "-1", "NaN", "Infinity", "1e3", "12,345", "12.3.4", "1 000", "99999999999999,99"]) assert.equal(rublesInputToMinor(input), null);
for (const [input, expected] of [[0, 0], [100.25, 10025], [0.29, 29], [175.53, 17553], [0.1 + 0.2, 30]]) assert.equal(balanceToMinor(input), expected);
for (const input of [NaN, Infinity, -1, 0.001, Number.MAX_VALUE]) assert.equal(balanceToMinor(input), null);
assert.equal((balanceToMinor(100) + rublesInputToMinor("50")) / 100, 150);
console.log("PASS: integer kopecks, comma/dot inputs, exact cent addition and invalid/unsafe amounts rejected.");
