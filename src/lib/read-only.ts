/**
 * Read-only mode for "view as". Firestore rules already reject every write an admin makes to a customer's data; this
 * stops the attempt earlier so the admin sees a clear message instead of a raw permission error.
 */
let readOnly = false;

export function setReadOnlyMode(value: boolean) {
  readOnly = value;
}

export function assertWritable() {
  if (readOnly) throw new Error("Read-only: you're viewing a customer's account. Exit view-as to make changes.");
}
