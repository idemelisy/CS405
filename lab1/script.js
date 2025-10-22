/*
This is a simple JavaScript file demonstrating various features of the language.
check the console from dev tools to see the outputs!
if you want to have a deep dive into JavaScript, check out: https://developer.mozilla.org/en-US/docs/Web/JavaScript
*/

//variables
var v = 1;  // function-scoped
let l = 2;  // block-scoped
const c = 3;  // block-scoped and immutable
console.log({ v, l, c });
//NOTE: for the let vs var difference, see the function scoping vs block scoping section

//types
const num = 42;
const str = "hello";
const bool = true;
const n = null;
let u;  //undefined 
const big = 9007199254740991n; // BigInt, ends with a 'n'
const sym = Symbol("id");
console.log("typeof:", { num: typeof num, str: typeof str, bool: typeof bool, n, u, big: typeof big, sym: typeof sym });

//operators
console.log("Arithmetic:", 5 + 2, 5 - 2, 5 * 2, 5 / 2, 5 % 2, 2 ** 3);
console.log("Comparison:", 2 == "2", 2 === "2", 3 > 2, 3 >= 3, 2 != 3, 2 !== "2");
console.log("Logical:", true && false, true || false, !false);
console.log("Nullish coalescing:", null ?? "fallback", 0 ?? "nope");
console.log(`this is a normal string too!`) //template literals

//strings
const first = "John", last = "Doe";
const greeting = `Hi ${first} ${last}! 2 + 2 = ${2 + 2}`;
console.log(greeting);
console.log("Methods:", "  trim  ".trim().toUpperCase(), "hello".includes("ell"));

//Arrays
const arr = [1, 2, 3];
arr.push(4);        // [1,2,3,4]
const lastPopped = arr.pop(); // removes 4
arr.unshift(0);     // [0,1,2,3]
const firstShifted = arr.shift(); // removes 0
console.log({ arr, lastPopped, firstShifted, length: arr.length });

const more = [4, 5];
const merged = [...arr, ...more]; // spread
const [a, b, ...rest] = merged;   // destructuring
console.log({ merged, a, b, rest });

let DummyVertexShaderSource = [
    "attribute vec4 a_position;",
    "void main() {",
    "  gl_Position = a_position;",
    "}"
].join("\n");
console.log(DummyVertexShaderSource);

//Array methods
const nums = [1, 2, 3, 4, 5];
const doubled = nums.map(x => x * 2);
const evens = nums.filter(x => x % 2 === 0);
const sum = nums.reduce((acc, x) => acc + x, 0);
const found = nums.find(x => x > 3);
nums.forEach(x => console.log("forEach number:", x));

//control flow
const score = 82;

if (score >= 90) {
  console.log("Grade: A");
} else if (score >= 80) {
  console.log("Grade: B");
} else if (score >= 70) {
  console.log("Grade: C");
} else {
  console.log("Grade: D/F");
}

//swtich statements
const light = "yellow";

switch (light) {
  case "red":
    console.log("Stop");
    break;
  case "yellow":
  case "amber":
    console.log("Caution");
    break;
  case "green":
    console.log("Go");
    break;
  default:
    console.log("Unknown signal");
}

//ternary operator
const nCF = 7;
const parity = (nCF % 2 === 0) ? "even" : "odd";
console.log(`nCF=${nCF} is ${parity}`);

//loops
for (let i = 0; i < 3; i++) {
  console.log("for i:", i);
}

let w = 0;
while (w < 2) {
  console.log("while:", w);
  w++;
}

let d = 0;
do {
  console.log("do...while:", d);
  d++;
} while (d < 2);

const itemsCF = ["a", "b", "skip", "c"];
for (const val of itemsCF) {
  if (val === "skip") { 
    console.log("continue at:", val);
    continue; 
  }
  console.log("for...of:", val);
}

//functions
let subtract = function(x, y) {
  return x - y;
};

function add(x, y) {
  return x + y;
}

const multiply = (x, y) => x * y; //arrow function!

console.log("subtract(5,2):", subtract(5, 2));
console.log("add(2,3):", add(2, 3));
console.log("multiply(2,3):", multiply(2, 3));

//Function scoping vs block scoping
function scopeTest() {
  if (true) {
    var usingVar = "var inside block";
    let usingLet = "let inside block";
    console.log("inside block:", { usingVar, usingLet });
  }
  // var is function-scoped: accessible here
  console.log("outside block (var):", usingVar);
  // let is block-scoped: not accessible here
  try {
    console.log("outside block (let):", usingLet);
  } catch (e) {
    console.log("outside block (let): ReferenceError ->", e.message);
  }
}

scopeTest();

//DOM Manipulation and Events
let svg = document.getElementById("mysvg"); //selecting element with an id
let circle = document.querySelector("#circle1"); //selecting element with css selector

let div = document.createElement("div");
let body = document.body;
div.textContent = "This div was created and added by JavaScript!";
div.style.backgroundColor = "purple";
div.style.padding = "10px";
div.style.color = "white";
body.appendChild(div);

//Drag and Drop example for SVG Circle(see html)
let isClicked = false;
let clickedElement = null;
svg.addEventListener("mousedown",(e)=>{
    isClicked = true;
    clickedElement = e.target;
})

svg.addEventListener("mousemove", (e)=>{
    if(isClicked && clickedElement){
        clickedElement.setAttribute("cx", e.offsetX);
        clickedElement.setAttribute("cy", e.offsetY);
    }
})

svg.addEventListener("mouseup", (e)=>{
    isClicked = false;
    clickedElement = null;
})


//Event bubbling and propagaton + capture events!
let grandparent = document.getElementById("grandparent");
let parent = document.getElementById("parent");
let child = document.getElementById("child");

grandparent.style.width = "200px";
grandparent.style.height = "200px";
grandparent.style.backgroundColor = "lightblue";
grandparent.style.display = "flex";
grandparent.style.justifyContent = "center";
grandparent.style.alignItems = "center";

parent.style.width = "100px";
parent.style.height = "100px";
parent.style.backgroundColor = "green";
parent.style.display = "flex";
parent.style.justifyContent = "center";
parent.style.alignItems = "center";

child.style.width = "50px";
child.style.height = "50px";
child.style.backgroundColor = "red";


grandparent.addEventListener("click", (e)=>{
    console.log("Grandparent capture clicked");
}, {capture:true});

grandparent.addEventListener("click", (e)=>{
    console.log("Grandparent clicked");
});

parent.addEventListener("click", (e)=>{
    console.log("Parent clicked");
});

child.addEventListener("click", (e)=>{
    console.log("Child clicked");
    // e.stopPropagation(); --> uncomment to see the effect! 
});