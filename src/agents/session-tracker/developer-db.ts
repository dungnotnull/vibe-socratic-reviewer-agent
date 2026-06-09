import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  DeveloperUnderstandingGraph,
  ConceptMastery,
  ConceptInProgress,
  ConceptGap,
} from '../../types';

const DB_PATH = path.join(process.cwd(), '.socratic-sessions.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  const d = db!;

  d.exec(`
    CREATE TABLE IF NOT EXISTS developers (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      concepts_learned_count INTEGER DEFAULT 0,
      incidents_prevented INTEGER DEFAULT 0,
      total_sessions INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS concept_mastery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      developer_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      demonstrated_date TEXT NOT NULL,
      demonstrated_in TEXT,
      notes TEXT,
      FOREIGN KEY (developer_id) REFERENCES developers(id),
      UNIQUE(developer_id, concept)
    );

    CREATE TABLE IF NOT EXISTS concept_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      developer_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      exposure_count INTEGER DEFAULT 1,
      last_questioned TEXT NOT NULL,
      FOREIGN KEY (developer_id) REFERENCES developers(id),
      UNIQUE(developer_id, concept)
    );

    CREATE TABLE IF NOT EXISTS concept_gaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      developer_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      missed_count INTEGER DEFAULT 1,
      last_missed_date TEXT NOT NULL,
      FOREIGN KEY (developer_id) REFERENCES developers(id),
      UNIQUE(developer_id, concept)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      developer_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      request_text TEXT,
      blind_spots_found TEXT,
      questions_asked TEXT,
      outcome TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function getOrCreateDeveloper(developerId: string): DeveloperUnderstandingGraph {
  const d = getDb();

  let dev = d.prepare('SELECT * FROM developers WHERE id = ?').get(developerId) as any;

  if (!dev) {
    d.prepare(
      'INSERT INTO developers (id, start_date, concepts_learned_count, incidents_prevented, total_sessions) VALUES (?, ?, 0, 0, 0)'
    ).run(developerId, new Date().toISOString());
  }

  return loadDeveloperGraph(developerId);
}

export function loadDeveloperGraph(developerId: string): DeveloperUnderstandingGraph {
  const d = getDb();

  const dev = d.prepare('SELECT * FROM developers WHERE id = ?').get(developerId) as any;
  const mastered = d.prepare('SELECT * FROM concept_mastery WHERE developer_id = ?').all(developerId) as ConceptMastery[];
  const learning = d.prepare('SELECT * FROM concept_progress WHERE developer_id = ?').all(developerId) as ConceptInProgress[];
  const gaps = d.prepare('SELECT * FROM concept_gaps WHERE developer_id = ?').all(developerId) as ConceptGap[];

  return {
    developerId,
    masteredConcepts: mastered,
    learningConcepts: learning,
    gapConcepts: gaps,
    trajectory: {
      startDate: dev?.start_date ?? new Date().toISOString(),
      conceptsLearnedCount: dev?.concepts_learned_count ?? 0,
      incidentsPreventedEstimate: dev?.incidents_prevented ?? 0,
      totalSocraticSessions: dev?.total_sessions ?? 0,
    },
  };
}

export function recordMastery(developerId: string, concept: string, context: string, notes?: string): void {
  const d = getDb();

  d.prepare(
    `INSERT OR REPLACE INTO concept_mastery (developer_id, concept, demonstrated_date, demonstrated_in, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(developerId, concept, new Date().toISOString(), context, notes ?? '');

  d.prepare('DELETE FROM concept_progress WHERE developer_id = ? AND concept = ?').run(developerId, concept);
  d.prepare('DELETE FROM concept_gaps WHERE developer_id = ? AND concept = ?').run(developerId, concept);

  d.prepare(
    'UPDATE developers SET concepts_learned_count = concepts_learned_count + 1 WHERE id = ?'
  ).run(developerId);
}

export function recordProgress(developerId: string, concept: string): void {
  const d = getDb();

  const existing = d.prepare(
    'SELECT * FROM concept_progress WHERE developer_id = ? AND concept = ?'
  ).get(developerId, concept);

  if (existing) {
    d.prepare(
      'UPDATE concept_progress SET exposure_count = exposure_count + 1, last_questioned = ? WHERE developer_id = ? AND concept = ?'
    ).run(new Date().toISOString(), developerId, concept);
  } else {
    d.prepare(
      'INSERT INTO concept_progress (developer_id, concept, exposure_count, last_questioned) VALUES (?, ?, 1, ?)'
    ).run(developerId, concept, new Date().toISOString());
  }
}

export function recordGap(developerId: string, concept: string): void {
  const d = getDb();

  const existing = d.prepare(
    'SELECT * FROM concept_gaps WHERE developer_id = ? AND concept = ?'
  ).get(developerId, concept);

  if (existing) {
    d.prepare(
      'UPDATE concept_gaps SET missed_count = missed_count + 1, last_missed_date = ? WHERE developer_id = ? AND concept = ?'
    ).run(new Date().toISOString(), developerId, concept);
  } else {
    d.prepare(
      'INSERT INTO concept_gaps (developer_id, concept, missed_count, last_missed_date) VALUES (?, ?, 1, ?)'
    ).run(developerId, concept, new Date().toISOString());
  }
}

export function isConceptMastered(developerId: string, concept: string): boolean {
  const d = getDb();
  const row = d.prepare(
    'SELECT 1 FROM concept_mastery WHERE developer_id = ? AND concept = ?'
  ).get(developerId, concept);
  return row !== undefined;
}

export function recordSession(
  sessionId: string,
  developerId: string,
  mode: string,
  requestText: string,
  blindSpotsFound: string[],
  questionsAsked: string[],
  outcome: string
): void {
  const d = getDb();

  d.prepare(
    `INSERT OR REPLACE INTO sessions (id, developer_id, mode, request_text, blind_spots_found, questions_asked, outcome, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    developerId,
    mode,
    requestText,
    JSON.stringify(blindSpotsFound),
    JSON.stringify(questionsAsked),
    outcome,
    new Date().toISOString()
  );

  d.prepare(
    'UPDATE developers SET total_sessions = total_sessions + 1 WHERE id = ?'
  ).run(developerId);
}

export function recordIncidentPrevented(developerId: string): void {
  const d = getDb();
  d.prepare(
    'UPDATE developers SET incidents_prevented = incidents_prevented + 1 WHERE id = ?'
  ).run(developerId);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
