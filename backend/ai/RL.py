import os
import random
import pickle
import logging
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from functools import lru_cache
from typing import List, Dict, Any

_tfidf_vectorizer = TfidfVectorizer(lowercase=True, analyzer='word', stop_words='english')
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    filename="logs/app.log",
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class RLAgent:
    def __init__(
        self, 
        actions: List[str], 
        learning_rate: float = 0.6, 
        discount_factor: float = 0.9, 
        epsilon: float = 0.9, 
        backup_file: str = "q_values.pkl",
        decay_rate: float = 0.995,
        min_epsilon: float = 0.05,
        reward_threshold: float = 8.0
    ):
        self.actions = actions
        self.epsilon = epsilon
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.backup_file = backup_file
        self.decay_rate = decay_rate
        self.min_epsilon = min_epsilon
        self.reward_threshold = reward_threshold
        self.q_values = self._load_q_values()
        self.action_history: List[str] = []
        self.reward_history: List[float] = []
        
    def _decay_epsilon(self, avg_score: float) -> None:
        factor = self.decay_rate if avg_score > self.reward_threshold else 0.98
        self.epsilon = max(self.epsilon * factor, self.min_epsilon)

    def select_action(self) -> str:
        if random.random() < self.epsilon:
            return random.choice(self.actions)
        else:
            return max(self.actions, key=lambda x: self.q_values.get(x, 0.0))
    
    def select_action_with_temperature(self, temperature: float = 1.0) -> str:
        if random.random() < self.epsilon:
            return random.choice(self.actions)
        else:
            q_values = np.array([self.q_values.get(a, 0.0) for a in self.actions])
            if temperature == 0:
                return self.actions[np.argmax(q_values)]
            
            q_values = q_values / temperature
            exp_q = np.exp(q_values - np.max(q_values))
            probs = exp_q / np.sum(exp_q)
            return np.random.choice(self.actions, p=probs)

    def update_q_value(self, action_index: int, reward: float) -> None:
        action = self.actions[action_index]
        current_q = self.q_values.get(action, 0.0)
        updated_q = current_q + self.learning_rate * (reward - current_q)
        self.q_values[action] = updated_q
        
        self.action_history.append(action)
        self.reward_history.append(reward)
        
        if len(self.action_history) % 10 == 0:
            self._save_q_values()
            
        self._decay_epsilon(reward)
        logging.info(f"[RLAgent] Action: '{action}' | Q-value: {updated_q:.4f} | Reward: {reward:.4f} | Epsilon: {self.epsilon:.4f}")

    def _save_q_values(self) -> None:
        try:
            with open(self.backup_file, 'wb') as f:
                pickle.dump(self.q_values, f, protocol=pickle.HIGHEST_PROTOCOL)
            logging.debug(f"[RLAgent] Saved Q-values: {self.q_values}")
        except Exception as e:
            logging.error(f"[RLAgent] Failed to save Q-values: {e}")

    def _load_q_values(self) -> Dict[str, float]:
        if os.path.isfile(self.backup_file):
            try:
                with open(self.backup_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                logging.error(f"[RLAgent] Failed to load Q-values: {e}")
        return {action: 0.0 for action in self.actions}

    def __del__(self) -> None:
        self._save_q_values()
        
    @staticmethod
    @lru_cache(maxsize=1000)
    def compute_similarity(query: str, response: str) -> float:
        try:
            query_str = str(query) if query is not None else ""
            response_str = str(response) if response is not None else ""
            if not query_str.strip() or not response_str.strip():
                return 0.0
                
            vecs = _tfidf_vectorizer.fit_transform([query_str, response_str])
            return cosine_similarity(vecs[0:1], vecs[1:2])[0, 0]
        except Exception as e:
            logging.error(f"[RLAgent] TF-IDF computation failed: {e}")
            return 0.0

    def _compute_reward(
        self, 
        action_index: int, 
        response: str, 
        query: str, 
        val_score: int, 
        latency: int,
        weight_sim: float = 1.0,
        weight_val: float = 0.5,
        weight_latency: float = 0.2
    ) -> float:

        try:
            val_score = int(val_score) if val_score is not None else 5
            latency = int(latency) if latency is not None else 0
        except (ValueError, TypeError):
            val_score = 5
            latency = 0
            
        sim = self.compute_similarity(query, response)
        sim_scaled = sim ** 2 * 10
        noise = random.gauss(0, 0.3)
        reward = sim_scaled * weight_sim + noise
        if val_score < 8:
            reward -= (8 - val_score) * weight_val
        else:
            reward += (val_score - 8) * weight_val
        if latency > 60:
            reward -= (latency - 60) * weight_latency  
        reward = max(min(reward, 20), -10)
        self.update_q_value(action_index, reward)
        return reward
    
    def get_performance_stats(self) -> Dict[str, Any]:
        if not self.reward_history:
            return {"status": "No data available"} 
        
        return {
            "avg_reward": np.mean(self.reward_history[-100:]),
            "max_reward": max(self.reward_history[-100:]) if self.reward_history else 0,
            "min_reward": min(self.reward_history[-100:]) if self.reward_history else 0,
            "current_epsilon": self.epsilon,
            "q_value_spread": max(self.q_values.values()) - min(self.q_values.values()) if self.q_values else 0,
            "most_valuable_action": max(self.q_values.items(), key=lambda x: x[1])[0] if self.q_values else None,
            "least_valuable_action": min(self.q_values.items(), key=lambda x: x[1])[0] if self.q_values else None,
        }