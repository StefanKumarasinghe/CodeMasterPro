import os
import random
import pickle
import logging

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

_tfidf_vectorizer = TfidfVectorizer()
logging.basicConfig(filename="logs/app.log", level=logging.INFO)

class RLAgent:
    def __init__(self, actions, learning_rate=0.6, discount_factor=0.9, epsilon=0.9, backup_file="q_values.pkl"):
        self.actions = actions
        self.epsilon = epsilon
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.backup_file = backup_file
        self.q_values = self._load_q_values()

    def _decay_epsilon(self, avg_score):
        factor = 0.995 if avg_score > 8 else 0.98
        self.epsilon = max(self.epsilon * factor, 0.1)

    def select_action(self):
        return (
            random.choice(self.actions)
            if random.random() < self.epsilon
            else max(self.actions, key=self.q_values.get)
        )

    def update_q_value(self, action_index, reward):
        action = self.actions[action_index]
        current_q = self.q_values.get(action, 0.0)
        updated_q = current_q + self.learning_rate * (reward - current_q)
        self.q_values[action] = updated_q
        self._save_q_values()
        self._decay_epsilon(reward)
        logging.info(f"[RLAgent] Updated Q-value for action '{action}': {updated_q:.4f}")

    def _save_q_values(self):
        try:
            with open(self.backup_file, 'wb') as f:
                pickle.dump(self.q_values, f, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception as e:
            logging.error(f"[RLAgent] Failed to save Q-values: {e}")

    def _load_q_values(self):
        if os.path.isfile(self.backup_file):
            try:
                with open(self.backup_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                logging.error(f"[RLAgent] Failed to load Q-values: {e}")
        return {action: 0.0 for action in self.actions}

    def __del__(self):
        self._save_q_values()

    def _compute_reward(self, agent, action_index, response: str, query: str, val_score: int) -> float:
        try:
            vecs = _tfidf_vectorizer.fit_transform([query, response])
            sim = cosine_similarity(vecs[0:1], vecs[1:2])[0, 0]
            sim_scaled = sim ** 2 * 10
        except Exception as e:
            logging.error(f"[RLAgent] TF-IDF computation failed: {e}")
            sim_scaled = 0.0

        noise = random.gauss(0, 0.5)
        reward = sim_scaled + noise

        if len(response) > 5000 and response.strip():
            reward -= 1
        if val_score < 8:
            reward -= (8 - val_score) * 0.5

        reward = max(min(reward, 20), -10)
        agent.update_q_value(action_index, reward)
        return reward
