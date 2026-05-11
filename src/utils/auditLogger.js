import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// ─── Auth helpers ──────────────────────────────────────────────────────────────

const getCachedUser = () => {
  try {
    const cached = localStorage.getItem('cachedUser');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error reading cached user for audit log:', error);
    return null;
  }
};

const getActor = (actor = {}) => {
  const cachedUser  = getCachedUser();
  const currentUser = auth.currentUser;
  const user        = actor.user || currentUser || cachedUser || {};

  return {
    userId:    actor.userId    || user.uid            || cachedUser?.uid            || '',
    userEmail: actor.userEmail || user.email          || cachedUser?.email          || '',
    userName:  actor.userName  || user.displayName    || cachedUser?.displayName    || user.email || cachedUser?.email || 'Unknown user',
    role:      actor.role      || user.role           || cachedUser?.role           || 'unknown',
  };
};

// ─── Entity name resolution ────────────────────────────────────────────────────

/**
 * Try to resolve a Firestore document ID to a human-readable name.
 * Checks `students` first, then `professors`.
 * Returns null if not found or on error.
 */
const resolveEntityName = async (id) => {
  if (!id || typeof id !== 'string' || id.length < 10) return null;

  const collections = ['students', 'professors'];
  for (const col of collections) {
    try {
      const snap = await getDoc(doc(db, col, id));
      if (snap.exists()) {
        const d = snap.data();
        return d.name || d.displayName || d.email || null;
      }
    } catch {
      // collection may not contain this ID — continue
    }
  }
  return null;
};

// ─── Payable title resolution ──────────────────────────────────────────────────

/**
 * Derive a meaningful payable label from the log's `details` object.
 * Falls back gracefully so "Untitled Payable" never reaches the log.
 *
 * Priority:
 *   details.courseCode > details.subjectCode > details.title > details.name >
 *   entityType (when it isn't just "Payable") > "Payable"
 */
const resolvePayableTitle = (details = {}, entityType = '') => {
  return (
    details.courseCode  ||
    details.subjectCode ||
    details.moduleName  ||
    details.title       ||
    details.name        ||
    details.label       ||
    (entityType && !/^(payable|modulePayable|otherPayable)$/i.test(entityType.trim())
      ? entityType
      : null) ||
    'Payable'
  );
};

// ─── Description builder ───────────────────────────────────────────────────────

/**
 * Build a meaningful description string, resolving entity IDs to names
 * and replacing any "Untitled Payable" tokens.
 *
 * If `description` is supplied by the caller, we clean it up.
 * If it is empty we synthesise one from entityType + entityId.
 */
const buildDescription = async ({
  description,
  entityType,
  entityId,
  details,
}) => {
  // Resolve the primary entity (student/professor) by ID if present
  const entityName = entityId ? await resolveEntityName(entityId) : null;

  let text = description || '';

  // If description is empty, synthesise something useful
  if (!text) {
    const typeLabel = entityType || 'Record';
    text = entityName ? `${typeLabel}: ${entityName}` : typeLabel;
  }

  // Swap in the resolved name wherever the raw ID appears
  if (entityId && entityName) {
    text = text.replaceAll(entityId, entityName);
  }

  // Remove "Untitled Payable" — replace with a meaningful payable label
  if (text.toLowerCase().includes('untitled payable')) {
    const payableTitle = resolvePayableTitle(details, entityType);
    text = text.replace(/untitled payable/gi, payableTitle);
  }

  return text.replace(/\s+/g, ' ').trim();
};

// ─── Public API ────────────────────────────────────────────────────────────────

export const logSystemAction = async ({
  action,
  module      = 'System',
  entityType  = '',
  entityId    = '',
  description = '',
  details     = {},
  actor       = {},
}) => {
  try {
    const now           = new Date();
    const resolvedActor = getActor(actor);

    // Resolve description (async: may hit Firestore for a name)
    const resolvedDescription = await buildDescription({
      description,
      entityType,
      entityId,
      details,
    });

    await addDoc(collection(db, 'systemLogs'), {
      action,
      module,
      entityType,
      entityId,
      description: resolvedDescription,
      details,
      ...resolvedActor,
      date: now.toLocaleDateString('en-US', {
        year:  'numeric',
        month: 'long',
        day:   '2-digit',
      }),
      time: now.toLocaleTimeString('en-US', {
        hour:   'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      createdAt: now.toISOString(),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error writing system log:', error);
  }
};