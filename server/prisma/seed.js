import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertCourse(instructorId, title, description, isPublished) {
  return prisma.course.upsert({
    where: { instructorId_title: { instructorId, title } },
    update: { description, isPublished },
    create: { title, description, instructorId, isPublished },
  })
}

// Upsert module by (courseId, position) — deterministic
async function upsertModule(courseId, position, title) {
  const existing = await prisma.module.findFirst({
    where: { courseId, position },
  })
  if (existing) {
    return prisma.module.update({ where: { id: existing.id }, data: { title } })
  }
  return prisma.module.create({ data: { courseId, position, title } })
}

// Upsert lesson by (moduleId, position)
async function upsertLesson(moduleId, position, data) {
  const existing = await prisma.lesson.findFirst({
    where: { moduleId, position },
  })
  if (existing) {
    return prisma.lesson.update({ where: { id: existing.id }, data })
  }
  return prisma.lesson.create({ data: { moduleId, position, ...data } })
}

// Upsert quiz by moduleId
async function upsertQuiz(moduleId, title, passMark, timeLimitMin, questions) {
  let quiz = await prisma.quiz.findUnique({ where: { moduleId } })
  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: { moduleId, title, passMark, timeLimitMin },
    })
  } else {
    quiz = await prisma.quiz.update({
      where: { id: quiz.id },
      data: { title, passMark, timeLimitMin },
    })
    // wipe existing questions to re-seed cleanly
    await prisma.question.deleteMany({ where: { quizId: quiz.id } })
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    await prisma.question.create({
      data: {
        quizId: quiz.id,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        position: i,
      },
    })
  }
  return quiz
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const COURSES = [
  // =========================================================================
  // COURSE 1 — JavaScript Fundamentals (published)
  // =========================================================================
  {
    title: "JavaScript Fundamentals",
    description:
      "A comprehensive introduction to modern JavaScript — from variables to async/await.",
    isPublished: true,
    modules: [
      {
        title: "Core Language Basics",
        lessons: [
          {
            title: "Variables, Scope & Hoisting",
            type: "TEXT",
            content: `# Variables, Scope & Hoisting

## var, let, const
- **var** is function-scoped and hoisted to the top of its function (initialised as \`undefined\`).
- **let** and **const** are block-scoped and in the Temporal Dead Zone (TDZ) until the declaration line.
- Prefer \`const\` by default; use \`let\` when the value must change; avoid \`var\`.

## Hoisting
Only the *declaration* is hoisted, not the assignment.
\`\`\`js
console.log(x); // undefined
var x = 5;
\`\`\`
\`let\` and \`const\` throw a ReferenceError if accessed before declaration.

## Scope Chain
When a variable is not found in the local scope the engine walks up to the parent scope, continuing until the global scope.`,
            level: "Beginner",
            keywords: ["var", "let", "const", "hoisting", "scope"],
          },
          {
            title: "Functions & Closures",
            type: "TEXT",
            content: `# Functions & Closures

## Function Types
| Form | Syntax | Has own \`this\`? |
|------|--------|----------------|
| Declaration | \`function foo() {}\` | ✅ |
| Expression | \`const foo = function() {}\` | ✅ |
| Arrow | \`const foo = () => {}\` | ❌ (inherits) |

## Closures
A closure is a function that retains access to its outer lexical environment even after that outer function has returned.

\`\`\`js
function counter() {
  let count = 0;
  return () => ++count;
}
const inc = counter();
inc(); // 1
inc(); // 2
\`\`\`

**Use cases**: data privacy, partial application, memoisation.`,
            level: "Beginner",
            keywords: ["function", "arrow", "closure", "lexical scope"],
          },
          {
            title: "What is the Event Loop? (Video)",
            type: "VIDEO",
            videoUrl: "https://www.youtube.com/embed/8aGhZQkoFbQ",
            topic: "JavaScript Event Loop",
            level: "Intermediate",
            keywords: ["event loop", "call stack", "microtask", "macrotask"],
            aiContext: `# JavaScript Event Loop — Reference Notes

## Overview & Objectives
Understand how JavaScript, a single-threaded language, handles concurrency through the event loop, call stack, and task queues.

## Core Concepts
- **Call Stack**: LIFO structure where function execution contexts are pushed/popped. Only one frame runs at a time.
- **Web APIs / Node APIs**: Asynchronous operations (setTimeout, fetch, I/O) are offloaded here, freeing the stack.
- **Task Queue (Macro-task Queue)**: Completed callbacks from setTimeout, setInterval, I/O wait here.
- **Microtask Queue**: Promise \`.then\` callbacks and \`queueMicrotask\` land here. Processed *entirely* before the next macro-task.
- **Event Loop**: Continuously checks: if the stack is empty, drain all microtasks, then pick one macro-task and repeat.

## Execution Order
1. Synchronous code runs to completion on the call stack.
2. All microtasks (Promises) are drained.
3. One macro-task (setTimeout cb, etc.) is executed.
4. Back to step 2.

## Common Pitfalls
- \`setTimeout(fn, 0)\` does NOT run immediately — it runs after microtasks.
- Long synchronous loops block the entire event loop (no I/O, no rendering).
- Unhandled promise rejections originate from missed \`.catch\` handlers.

## Key Takeaways
- Microtasks have priority over macro-tasks.
- Never block the event loop with synchronous heavy computation — use workers or chunking.`,
          },
        ],
        quiz: {
          title: "Core Language Basics Quiz",
          passMark: 70,
          timeLimitMin: 10,
          questions: [
            {
              prompt: "Which keyword creates a block-scoped variable that can be reassigned?",
              options: ["var", "let", "const", "function"],
              correctIndex: 1,
            },
            {
              prompt: "What is printed? `console.log(x); var x = 1;`",
              options: ["1", "ReferenceError", "undefined", "null"],
              correctIndex: 2,
            },
            {
              prompt: "What does a closure capture?",
              options: [
                "A snapshot of variable values at call time",
                "A reference to its outer lexical environment",
                "Only global variables",
                "Nothing — closures have no access to outer scope",
              ],
              correctIndex: 1,
            },
            {
              prompt: "Which function form does NOT have its own `this`?",
              options: [
                "Function declaration",
                "Function expression",
                "Arrow function",
                "Generator function",
              ],
              correctIndex: 2,
            },
            {
              prompt: "Which queue is fully drained BEFORE the next macro-task runs?",
              options: ["Macro-task queue", "Microtask queue", "Render queue", "I/O queue"],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        title: "Asynchronous JavaScript",
        lessons: [
          {
            title: "Promises Deep Dive",
            type: "TEXT",
            content: `# Promises

## States
A Promise is in one of three states: **pending**, **fulfilled**, or **rejected**.

## Chaining
\`\`\`js
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err))
  .finally(() => console.log('done'));
\`\`\`

## Promise combinators
| Method | Settles when |
|--------|-------------|
| \`Promise.all\` | All fulfill, or first rejects |
| \`Promise.allSettled\` | All settle (any outcome) |
| \`Promise.race\` | First settles |
| \`Promise.any\` | First fulfills |

## Common mistakes
- Forgetting to \`return\` inside \`.then\` (breaks the chain).
- Swallowing errors by omitting \`.catch\`.`,
            level: "Intermediate",
            keywords: ["promise", "then", "catch", "async", "combinators"],
          },
          {
            title: "Async/Await Explained (Video)",
            type: "VIDEO",
            videoUrl: "https://www.youtube.com/embed/V_Kr9OSfDeU",
            topic: "async/await in JavaScript",
            level: "Intermediate",
            keywords: ["async", "await", "try-catch", "error handling"],
            aiContext: `# Async/Await — Reference Notes

## Overview
\`async/await\` is syntactic sugar over Promises, making asynchronous code look and behave more like synchronous code.

## Core Rules
- An \`async\` function **always** returns a Promise, even if the return value is a plain value.
- \`await\` can only be used *inside* an \`async\` function (or at the top level of an ES module).
- \`await\` pauses execution of the **current async function** (not the whole thread) until the awaited Promise settles.

## Error Handling
Use \`try/catch\` around \`await\` expressions:
\`\`\`js
async function loadUser(id) {
  try {
    const res = await fetch(\`/users/\${id}\`);
    if (!res.ok) throw new Error('Not found');
    return await res.json();
  } catch (err) {
    console.error(err);
  }
}
\`\`\`

## Parallelism
Sequential (slow): \`const a = await fa(); const b = await fb();\`
Parallel (fast): \`const [a, b] = await Promise.all([fa(), fb()]);\`

## Common Mistakes
- \`await\` inside a \`forEach\` does NOT work as expected — use \`for...of\` or \`Promise.all\`.
- Forgetting \`await\` causes the variable to hold a pending Promise instead of the resolved value.

## Key Takeaways
- Prefer \`async/await\` for readability; use \`Promise.all\` for concurrent operations.
- Always handle errors with \`try/catch\` or \`.catch\` on the returned Promise.`,
          },
          {
            title: "Fetch API & Error Handling",
            type: "TEXT",
            content: `# Fetch API

## Basic usage
\`\`\`js
const res = await fetch('https://api.example.com/posts');
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
const posts = await res.json();
\`\`\`

## Sending data
\`\`\`js
await fetch('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Hello' }),
});
\`\`\`

## Key points
- \`fetch\` only rejects on **network failures**, not HTTP error status codes.
- Always check \`res.ok\` or \`res.status\`.
- Use \`AbortController\` to cancel requests.`,
            level: "Intermediate",
            keywords: ["fetch", "HTTP", "REST", "AbortController"],
          },
        ],
        quiz: {
          title: "Async JavaScript Quiz",
          passMark: 75,
          timeLimitMin: 12,
          questions: [
            {
              prompt: "What does `async` before a function guarantee?",
              options: [
                "The function runs in a worker thread",
                "The function always returns a Promise",
                "The function blocks execution",
                "The function has no return value",
              ],
              correctIndex: 1,
            },
            {
              prompt: "Which Promise combinator waits for ALL promises and fails fast on the first rejection?",
              options: ["Promise.allSettled", "Promise.any", "Promise.race", "Promise.all"],
              correctIndex: 3,
            },
            {
              prompt: "Does `fetch` reject the returned Promise on a 404 response?",
              options: [
                "Yes, it always rejects on non-2xx status",
                "No — it only rejects on network errors",
                "Yes, but only on 5xx errors",
                "It depends on the browser",
              ],
              correctIndex: 1,
            },
            {
              prompt: "What is wrong with using `await` inside a `forEach` callback?",
              options: [
                "Nothing — it works exactly as expected",
                "await is not allowed in arrow functions",
                "forEach does not wait for async callbacks to resolve",
                "forEach converts Promises to undefined",
              ],
              correctIndex: 2,
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // COURSE 2 — React in Practice (published)
  // =========================================================================
  {
    title: "React in Practice",
    description:
      "Build real-world UIs with React — components, hooks, state management, and performance.",
    isPublished: true,
    modules: [
      {
        title: "Components & State",
        lessons: [
          {
            title: "Thinking in Components",
            type: "TEXT",
            content: `# Thinking in Components

## What is a component?
A React component is a function that accepts **props** and returns JSX describing a piece of UI.

\`\`\`jsx
function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>;
}
\`\`\`

## Principles
- **Single Responsibility**: Each component does one thing well.
- **DRY**: Extract repeated UI into reusable components.
- **Composition over inheritance**: Build complex UIs by composing simple components.

## Props
- Read-only — never mutate props inside a component.
- Pass any JS value: strings, numbers, objects, functions, JSX.`,
            level: "Beginner",
            keywords: ["component", "props", "JSX", "composition"],
          },
          {
            title: "useState & useEffect (Video)",
            type: "VIDEO",
            videoUrl: "https://www.youtube.com/embed/O6P86uwfdR0",
            topic: "React Hooks: useState and useEffect",
            level: "Beginner",
            keywords: ["useState", "useEffect", "hooks", "re-render", "side effects"],
            aiContext: `# useState & useEffect — Reference Notes

## useState
- Declares a state variable and a setter: \`const [count, setCount] = useState(0)\`.
- Calling the setter schedules a re-render; React batches multiple setter calls in the same event handler.
- **Never mutate state directly** — always call the setter with the new value.
- For objects/arrays, pass a *new* reference: \`setItems([...items, newItem])\`.

## Functional updates
When the new state depends on the previous value, pass a function: \`setCount(prev => prev + 1)\`.

## useEffect
- Runs after the DOM has been painted.
- Signature: \`useEffect(setup, dependencies?)\`.
- **Empty array \`[]\`**: runs once after first render (mount).
- **No array**: runs after *every* render.
- **Specific deps**: runs when any dep changes.

## Cleanup
Return a cleanup function to cancel subscriptions, timers, or abort controllers:
\`\`\`js
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);
\`\`\`

## Common Mistakes
- Missing dependencies in the deps array causes stale closures.
- Triggering state updates inside an effect without a dep guard causes infinite loops.
- Fetching data without an abort signal causes state updates on unmounted components.

## Key Takeaways
- useState drives local UI state; useEffect syncs with external systems.
- Always clean up effects that set up subscriptions or timers.`,
          },
        ],
        quiz: {
          title: "Components & State Quiz",
          passMark: 70,
          timeLimitMin: 8,
          questions: [
            {
              prompt: "What does calling `setState` (the setter from useState) do?",
              options: [
                "Mutates state in place",
                "Schedules a re-render with the new state value",
                "Synchronously updates the DOM",
                "Calls the component function immediately",
              ],
              correctIndex: 1,
            },
            {
              prompt: "Which useEffect dependency array runs the effect only once after mount?",
              options: ["No array provided", "[undefined]", "[]", "[null]"],
              correctIndex: 2,
            },
            {
              prompt: "How should you add an item to a state array?",
              options: [
                "items.push(newItem); setItems(items);",
                "setItems([...items, newItem])",
                "items[items.length] = newItem;",
                "setItems(items.concat); // without calling it",
              ],
              correctIndex: 1,
            },
            {
              prompt: "What is the purpose of the cleanup function returned from useEffect?",
              options: [
                "To reset state to initial values",
                "To stop React from batching updates",
                "To cancel subscriptions or timers before the next effect or unmount",
                "To skip the next render",
              ],
              correctIndex: 2,
            },
          ],
        },
      },
      {
        title: "Advanced Hooks & Patterns",
        lessons: [
          {
            title: "useContext & Custom Hooks",
            type: "TEXT",
            content: `# useContext & Custom Hooks

## useContext
Avoids prop drilling by sharing values across the tree without passing through every level.

\`\`\`jsx
const ThemeContext = React.createContext('light');

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
\`\`\`

## Custom Hooks
Any function starting with \`use\` that calls other hooks.

\`\`\`jsx
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}
\`\`\`

**Rules of Hooks**: only call at the top level; only call from React functions.`,
            level: "Intermediate",
            keywords: ["useContext", "custom hook", "prop drilling", "rules of hooks"],
          },
          {
            title: "Performance: useMemo & useCallback (Video)",
            type: "VIDEO",
            videoUrl: "https://www.youtube.com/embed/uojLJFt9SzY",
            topic: "React Performance Optimisation",
            level: "Intermediate",
            keywords: ["useMemo", "useCallback", "React.memo", "performance", "re-render"],
            aiContext: `# React Performance — useMemo, useCallback & React.memo

## Why Optimise?
React re-renders a component whenever its state or props change. Child components re-render by default even if their props haven't changed.

## React.memo
Wraps a component so it only re-renders when its props change (shallow comparison).
\`\`\`jsx
const ExpensiveList = React.memo(({ items }) => <ul>...</ul>);
\`\`\`

## useCallback
Memoises a **function reference** so the same function object is passed to child components across renders.
\`\`\`jsx
const handleClick = useCallback(() => doSomething(id), [id]);
\`\`\`

## useMemo
Memoises a **computed value** so an expensive calculation only reruns when its deps change.
\`\`\`jsx
const sorted = useMemo(() => items.sort(compareFn), [items]);
\`\`\`

## When to Use
- \`React.memo\`: child component that renders often with the same props.
- \`useCallback\`: stable callback reference passed to memoised child or used in an effect dep.
- \`useMemo\`: expensive pure computation inside render.

## Common Mistakes
- Over-optimising — these hooks have overhead; profile first.
- Forgetting to list all deps (stale closure risk).
- Using \`useMemo\` for side effects (use \`useEffect\` instead).

## Key Takeaways
- Profile before optimising. Use React DevTools Profiler.
- Memoisation prevents unnecessary re-renders, not all re-renders.`,
          },
          {
            title: "Data Fetching Patterns",
            type: "TEXT",
            content: `# Data Fetching in React

## Basic pattern with useEffect
\`\`\`jsx
function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/posts', { signal: controller.signal })
      .then(r => r.json())
      .then(setPosts)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) return <Spinner />;
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
\`\`\`

## Best practices
- Always abort fetch on unmount to avoid "state update on unmounted component" errors.
- Keep loading and error state alongside data.
- For complex needs consider TanStack Query or SWR.`,
            level: "Intermediate",
            keywords: ["fetch", "useEffect", "AbortController", "loading state", "SWR"],
          },
        ],
        quiz: {
          title: "Advanced Hooks Quiz",
          passMark: 75,
          timeLimitMin: 10,
          questions: [
            {
              prompt: "What problem does `useContext` primarily solve?",
              options: [
                "Memoising expensive calculations",
                "Prop drilling — passing values deeply without threading through every component",
                "Synchronising with external APIs",
                "Managing form state",
              ],
              correctIndex: 1,
            },
            {
              prompt: "What does `useCallback` memoise?",
              options: [
                "A computed value",
                "A React element (JSX)",
                "A function reference",
                "A context value",
              ],
              correctIndex: 2,
            },
            {
              prompt: "When should you reach for `React.memo`?",
              options: [
                "Always, as a default",
                "When a child component re-renders often with the same props",
                "Only for class components",
                "When the component has no props",
              ],
              correctIndex: 1,
            },
            {
              prompt: "Why should you abort a fetch in a useEffect cleanup?",
              options: [
                "To improve network speed",
                "Because fetch always throws without an AbortController",
                "To prevent state updates on an unmounted component",
                "useEffect does not support fetch",
              ],
              correctIndex: 2,
            },
            {
              prompt: "What is the first step before applying performance optimisations in React?",
              options: [
                "Wrap every component in React.memo",
                "Replace all state with context",
                "Profile with React DevTools Profiler to find actual bottlenecks",
                "Move all logic to custom hooks",
              ],
              correctIndex: 2,
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // COURSE 3 — System Design Primer (DRAFT)
  // =========================================================================
  {
    title: "System Design Primer",
    description:
      "Learn to design scalable distributed systems — load balancing, caching, databases, and more.",
    isPublished: false,
    modules: [
      {
        title: "Foundations",
        lessons: [
          {
            title: "Scalability Concepts",
            type: "TEXT",
            content: `# Scalability

## Vertical vs Horizontal Scaling
- **Vertical (scale up)**: bigger machine — faster CPU, more RAM. Simple but has a hard limit.
- **Horizontal (scale out)**: more machines behind a load balancer. More complex, theoretically unlimited.

## Latency vs Throughput
- **Latency**: time to complete one request.
- **Throughput**: requests processed per unit time.

## CAP Theorem
A distributed system can guarantee at most two of: **Consistency**, **Availability**, **Partition Tolerance**.`,
            level: "Intermediate",
            keywords: ["scalability", "CAP theorem", "latency", "throughput"],
          },
          {
            title: "Load Balancing Explained (Video)",
            type: "VIDEO",
            videoUrl: "https://www.youtube.com/embed/K0Ta65OqQkY",
            topic: "Load Balancing",
            level: "Intermediate",
            keywords: ["load balancer", "round robin", "consistent hashing", "health check"],
            aiContext: `# Load Balancing — Reference Notes

## What is a Load Balancer?
A load balancer distributes incoming network requests across multiple backend servers to maximise throughput, minimise latency, and avoid overloading any single server.

## Algorithms
- **Round Robin**: requests distributed in order. Simple; works well for homogeneous servers.
- **Weighted Round Robin**: servers with more capacity get more requests.
- **Least Connections**: new request goes to the server with fewest active connections.
- **IP Hash / Consistent Hashing**: client IP determines server — ensures session stickiness.

## Layer 4 vs Layer 7
- **L4 (Transport)**: routes based on IP/TCP without inspecting content. Fast, less flexible.
- **L7 (Application)**: routes based on HTTP headers, URL, cookies. Enables content-based routing.

## Health Checks
Load balancers regularly probe backends. Unhealthy servers are removed from the pool until they recover.

## Key Takeaways
- Load balancers prevent single points of failure and enable horizontal scaling.
- Choose the algorithm based on workload: round-robin for uniform, least-connections for variable request durations.`,
          },
        ],
        quiz: {
          title: "Foundations Quiz",
          passMark: 70,
          timeLimitMin: 10,
          questions: [
            {
              prompt: "What is the main advantage of horizontal scaling over vertical scaling?",
              options: [
                "It is always cheaper",
                "It is simpler to implement",
                "It has no theoretical upper limit and improves fault tolerance",
                "It requires no load balancer",
              ],
              correctIndex: 2,
            },
            {
              prompt: "According to the CAP theorem, what can a distributed system guarantee?",
              options: [
                "All three: Consistency, Availability, Partition Tolerance",
                "At most two of the three properties",
                "Only one property at a time",
                "It depends on the database engine",
              ],
              correctIndex: 1,
            },
            {
              prompt: "Which load-balancing algorithm ensures the same client always reaches the same server?",
              options: ["Round Robin", "Least Connections", "IP Hash", "Weighted Round Robin"],
              correctIndex: 2,
            },
            {
              prompt: "What is the purpose of health checks in a load balancer?",
              options: [
                "To measure response time and report to developers",
                "To detect and remove unhealthy backend servers from the pool",
                "To encrypt traffic between client and server",
                "To cache responses",
              ],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        title: "Databases & Caching",
        lessons: [
          {
            title: "SQL vs NoSQL",
            type: "TEXT",
            content: `# SQL vs NoSQL

## Relational (SQL)
- Structured schema, ACID transactions.
- Strong consistency, powerful joins.
- Best for: financial data, e-commerce orders.

## NoSQL types
| Type | Example | Best for |
|------|---------|---------|
| Document | MongoDB | Flexible, nested JSON |
| Key-Value | Redis | Caching, sessions |
| Wide-column | Cassandra | Time-series, high write |
| Graph | Neo4j | Relationship queries |

## When to choose
- Complex relationships & transactions → SQL.
- Massive scale, flexible schema, geographic distribution → NoSQL.`,
            level: "Intermediate",
            keywords: ["SQL", "NoSQL", "ACID", "MongoDB", "Redis"],
          },
          {
            title: "Caching Strategies",
            type: "TEXT",
            content: `# Caching Strategies

## Why cache?
Reduce database load, decrease latency, improve throughput.

## Strategies
- **Cache-aside (Lazy Loading)**: app checks cache first; on miss, fetches from DB and populates cache.
- **Write-through**: writes go to cache and DB simultaneously.
- **Write-behind (Write-back)**: writes go to cache; DB is updated asynchronously.
- **Read-through**: cache sits in front of DB; cache handles fetching on miss.

## Cache eviction policies
LRU (Least Recently Used) · LFU (Least Frequently Used) · TTL (Time-To-Live)

## Cache invalidation
The hardest problem — stale data risks. Use short TTLs or event-driven invalidation.`,
            level: "Intermediate",
            keywords: ["cache", "Redis", "LRU", "TTL", "invalidation"],
          },
        ],
        quiz: {
          title: "Databases & Caching Quiz",
          passMark: 70,
          timeLimitMin: 10,
          questions: [
            {
              prompt: "Which NoSQL type is best suited for caching and session storage?",
              options: ["Document store", "Graph database", "Key-Value store", "Wide-column store"],
              correctIndex: 2,
            },
            {
              prompt: "In cache-aside strategy, what happens on a cache miss?",
              options: [
                "The request fails with an error",
                "The app fetches from the database and populates the cache",
                "The cache fetches from the database automatically",
                "The write goes to both cache and DB",
              ],
              correctIndex: 1,
            },
            {
              prompt: "What does TTL stand for in the context of caching?",
              options: [
                "Total Transfer Limit",
                "Time-To-Live",
                "Transaction-To-Log",
                "Thread-Task-Lock",
              ],
              correctIndex: 1,
            },
            {
              prompt: "Which caching write strategy updates the DB asynchronously after writing to the cache?",
              options: ["Cache-aside", "Write-through", "Read-through", "Write-behind"],
              correctIndex: 3,
            },
          ],
        },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // ── Users (unchanged) ───────────────────────────────────────────────────
  const instructorPassword = await bcrypt.hash("instructor@123", 10)
  const studentPassword = await bcrypt.hash("student@123", 10)

  const instructor = await prisma.user.upsert({
    where: { email: "instructor@lms.test" },
    update: { password: instructorPassword, role: "INSTRUCTOR" },
    create: {
      email: "instructor@lms.test",
      password: instructorPassword,
      name: "Instructor",
      role: "INSTRUCTOR",
    },
  })

  const student = await prisma.user.upsert({
    where: { email: "student@lms.test" },
    update: { password: studentPassword, role: "STUDENT" },
    create: {
      email: "student@lms.test",
      password: studentPassword,
      name: "Student",
      role: "STUDENT",
    },
  })

  console.log("✓ Users upserted:", instructor.email, "|", student.email)

  // ── Courses ─────────────────────────────────────────────────────────────
  for (const courseData of COURSES) {
    const course = await upsertCourse(
      instructor.id,
      courseData.title,
      courseData.description,
      courseData.isPublished,
    )
    console.log(`\n  Course: "${course.title}" (published=${course.isPublished})`)

    for (let mIdx = 0; mIdx < courseData.modules.length; mIdx++) {
      const modData = courseData.modules[mIdx]
      const mod = await upsertModule(course.id, mIdx, modData.title)
      console.log(`    Module [${mIdx}]: "${mod.title}"`)

      for (let lIdx = 0; lIdx < modData.lessons.length; lIdx++) {
        const lData = modData.lessons[lIdx]
        const { title, type, content, videoUrl, topic, level, keywords, aiContext } = lData
        const lesson = await upsertLesson(mod.id, lIdx, {
          title,
          type,
          content: content || null,
          videoUrl: videoUrl || null,
          topic: topic || null,
          level: level || null,
          keywords: keywords || [],
          aiContext: aiContext || null,
        })
        console.log(`      Lesson [${lIdx}]: "${lesson.title}" (${type})`)
      }

      if (modData.quiz) {
        const quiz = await upsertQuiz(
          mod.id,
          modData.quiz.title,
          modData.quiz.passMark,
          modData.quiz.timeLimitMin,
          modData.quiz.questions,
        )
        console.log(
          `      Quiz: "${quiz.title}" (${modData.quiz.questions.length} questions, pass=${quiz.passMark}%)`,
        )
      }
    }
  }

  console.log("\n✓ Seed complete")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
