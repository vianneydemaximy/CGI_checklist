"""
services/prioritizer.py

Module de priorisation des tâches extraites d'un RFP.

Rôle :
  Reçoit une liste de tâches brutes (titre, type) et leur attribue
  un score de priorité de 1 (critique) à 10 (faible importance).

Logique :
  1. Règles métier fixes (NDA, SOW → toujours priorité 1)
  2. Score basé sur le type de tâche
  3. Détection de mots-clés "urgents" dans le titre
  4. Pénalité pour les tâches peu précises (titre trop court)

Ce module est OPTIONNEL — la priorité peut toujours être modifiée
manuellement par le consultant dans l'interface.

Usage dans pdf_extractor.py :
    from services.prioritizer import Prioritizer
    p = Prioritizer()
    tasks = p.sort_and_score(tasks)
"""

import re
from typing import List, Dict, Any


# ── Règles métier fixes (mots-clés → priorité forcée) ─────────
FIXED_PRIORITY_RULES: List[Dict] = [
    # Priorité 1 — Critique, bloquant
    {"keywords": ["nda", "non-disclosure", "confidentiality agreement"],   "priority": 1},
    {"keywords": ["statement of work", "sow", "contract", "contrat"],       "priority": 1},
    {"keywords": ["purchase order", "bon de commande"],                     "priority": 1},

    # Priorité 2 — Nécessaire avant démarrage
    {"keywords": ["vpn", "remote access", "accès distant"],                 "priority": 2},
    {"keywords": ["active directory", "account creation", "sso"],           "priority": 2},
    {"keywords": ["gdpr", "data protection", "dpo contact"],                "priority": 2},
    {"keywords": ["security clearance", "habilitation", "clearance"],       "priority": 2},

    # Priorité 3 — Important mais pas bloquant
    {"keywords": ["database credential", "db access", "connection string"],  "priority": 3},
    {"keywords": ["project manager", "sponsor", "stakeholder contact"],     "priority": 3},
    {"keywords": ["architecture diagram", "technical documentation"],       "priority": 3},

    # Priorité 7 — Nice-to-have
    {"keywords": ["parking", "badge", "office access", "cafeteria"],        "priority": 7},
    {"keywords": ["org chart", "organigramme"],                             "priority": 8},
]

# ── Score de base par type de tâche ──────────────────────────
TYPE_BASE_SCORE: Dict[str, int] = {
    "document":      4,
    "access":        3,
    "authorization": 3,
    "information":   5,
}

# ── Mots-clés qui augmentent l'urgence (diminuent le score) ──
URGENT_KEYWORDS = [
    "urgent", "asap", "immediately", "before start",
    "day one", "first day", "required to start", "mandatory",
    "obligatoire", "avant démarrage", "bloquant",
]


class Prioritizer:
    """
    Attribue et trie les priorités d'une liste de tâches.
    """

    def score_task(self, task: Dict[str, Any]) -> int:
        """
        Calcule un score de priorité pour une tâche (1 = urgent, 10 = faible).

        Logique (par ordre d'application) :
          1. Règles fixes → priorité immédiatement retournée
          2. Score de base selon le type
          3. Réduction si mots urgents détectés
          4. Augmentation si titre trop vague
        """
        title_lower       = (task.get("title") or "").lower()
        description_lower = (task.get("description") or "").lower()
        combined          = title_lower + " " + description_lower

        # 1. Règles fixes — priorité forcée
        for rule in FIXED_PRIORITY_RULES:
            if any(kw in combined for kw in rule["keywords"]):
                return rule["priority"]

        # 2. Score de base selon le type
        task_type  = task.get("task_type", "document")
        base_score = TYPE_BASE_SCORE.get(task_type, 5)

        # 3. Urgence — réduction de 1 point si mots urgents détectés
        if any(kw in combined for kw in URGENT_KEYWORDS):
            base_score = max(1, base_score - 1)

        # 4. Pénalité si titre trop court ou vague (< 5 mots)
        word_count = len(title_lower.split())
        if word_count < 4:
            base_score = min(10, base_score + 1)

        return base_score

    def sort_and_score(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Attribue un score à chaque tâche et les trie par priorité croissante.

        Si la tâche a déjà une priorité fixée (ex: par le consultant),
        on la respecte et on ne la recalcule pas.

        Returns:
            Liste de tâches triées, chacune avec le champ 'priority' renseigné.
        """
        scored = []
        for task in tasks:
            # Ne pas écraser une priorité déjà définie manuellement (≠ valeur par défaut 5)
            if task.get("priority") is not None and task.get("priority") != 5:
                scored.append(task)
            else:
                scored.append({**task, "priority": self.score_task(task)})

        # Tri par priorité (1 en premier)
        scored.sort(key=lambda t: t.get("priority", 5))
        return scored

    def explain(self, task: Dict[str, Any]) -> str:
        """
        Retourne une explication textuelle du score attribué.
        Utile pour le débogage ou l'affichage dans l'UI.
        """
        score = self.score_task(task)
        title_lower = (task.get("title") or "").lower()

        for rule in FIXED_PRIORITY_RULES:
            if any(kw in title_lower for kw in rule["keywords"]):
                return f"Priority {score} — Fixed rule matched: '{', '.join(rule['keywords'][:2])}'"

        if any(kw in title_lower for kw in URGENT_KEYWORDS):
            return f"Priority {score} — Urgent keyword detected"

        return f"Priority {score} — Base score for type '{task.get('task_type', 'document')}'"