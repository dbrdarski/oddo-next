// --- Test Suite ---

import { Record, Tuple } from './src/intern.mjs'
import { isInstance } from './src/contract.mjs'
import { Add, Sub, Mul } from './src/domain.mjs'

console.log("=== ENUM INTERNING TESTS ===");
const node1 = Add(1, 2);
const node2 = Add(1, 2);
const node3 = Mul(1, 2);

console.log("Strict Reference Equality (Add === Add):", node1 === node2); // true
console.log("Different Constructor Identity (Add !== Mul):", node1 === node3); // false
console.log("Is instance of Add:", isInstance(node1, Add)); // true
console.log("String Output:", String(node1)); // Add(1, 2)

console.log("\n=== NESTED STRUCTURAL INTERNING ===");
const nested1 = Add(1, Mul(2, Sub(5, 3)));
const nested2 = Add(1, Mul(2, Sub(5, 3)));
console.log("Deep AST Reference Equality:", nested1 === nested2); // true

console.log("\n=== STANDARD OBJECTS & ARRAYS INTERNING ===");
const objA = Record({ x: Add(1, 2), arr: Tuple(10, 20) });
const objB = Record({ arr: Tuple(10, 20), x: Add(1, 2) });
console.log("Object Key-Order Independence Match:", objA === objB); // true
console.log("Nested Sub-node Sharing:", objA.x === node1); // true
