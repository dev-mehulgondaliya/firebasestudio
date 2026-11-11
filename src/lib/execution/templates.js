// Starter scripts for the playground, per execution mode.

export const TEMPLATES = {
  browser: [
    {
      id: "list",
      name: "List documents",
      code: `// Runs in your browser with the Firebase Web SDK. Security Rules apply.
const snapshot = await db.collection("users").limit(10).get();

console.log(\`Found \${snapshot.size} documents\`);
snapshot.forEach((doc) => {
  console.log(doc.id, doc.data());
});
`,
    },
    {
      id: "query-table",
      name: "Query into a table",
      code: `const snapshot = await db
  .collection("users")
  .where("status", "==", "active")
  .limit(20)
  .get();

console.table(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
`,
    },
    {
      id: "create",
      name: "Create a document",
      code: `const ref = await db.collection("notes").add({
  text: "Hello from Firebase Studio",
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
});

console.log("Created", ref.path);
return ref.id;
`,
    },
    {
      id: "whoami",
      name: "Current auth user",
      code: `// Sign in from the "Project auth" panel to test rules as a user.
const user = auth.currentUser;
console.log(user ? { uid: user.uid, email: user.email, anonymous: user.isAnonymous } : "Not signed in");
`,
    },
  ],
  server: [
    {
      id: "collections",
      name: "List root collections",
      code: `// Runs in an isolated Node.js worker with the Firebase Admin SDK.
// Admin access bypasses Security Rules.
const collections = await db.listCollections();
console.table(collections.map((col) => ({ id: col.id, path: col.path })));
`,
    },
    {
      id: "count",
      name: "Count documents",
      code: `const snapshot = await db.collection("users").count().get();
console.log("users:", snapshot.data().count);
`,
    },
    {
      id: "batch-update",
      name: "Batch update",
      code: `const snapshot = await db
  .collection("students")
  .where("status", "==", "pending")
  .limit(100)
  .get();

const batch = db.batch();
snapshot.forEach((doc) => {
  batch.update(doc.ref, {
    status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});
await batch.commit();

console.log(\`Updated \${snapshot.size} documents\`);
`,
    },
    {
      id: "auth-users",
      name: "List Auth users",
      code: `const { users } = await admin.auth().listUsers(20);
console.table(users.map((user) => ({ uid: user.uid, email: user.email, disabled: user.disabled })));
`,
    },
  ],
};

export function defaultCode(mode) {
  return TEMPLATES[mode]?.[0]?.code ?? "";
}
