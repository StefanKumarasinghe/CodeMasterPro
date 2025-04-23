import random
import os
import pickle
import config.tars as gemini

class RLAgent:
    def __init__(self, actions, learning_rate=0.1, discount_factor=0.9, epsilon=0.9, backup_file="q_values.pkl"):
        self.actions = actions
        self.epsilon = epsilon
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.epsilon = epsilon
        self.backup_file = backup_file
        self.q_values = {action: 0.0 for action in actions}
        self._load_q_values()

    def _decay_epsilon(self):
        self.epsilon = max(self.epsilon * 0.995, 0.1)

    def select_action(self):
        if random.random() < self.epsilon:
            return random.choice(self.actions)
        return max(self.actions, key=lambda action: self.q_values[action])

    def update_q_value(self, action_index, reward):
        action = self.actions[action_index]
        current_q_value = self.q_values.get(action, 0.0)
        new_q_value = current_q_value + self.learning_rate * (reward - current_q_value)
        self.q_values[action] = new_q_value
        self.save_q_values()
        self._decay_epsilon()

    def save_q_values(self):
        try:
            with open(self.backup_file, 'wb') as f:
                pickle.dump(self.q_values, f)
        except Exception:
            pass

    def _load_q_values(self):
        try:
            if os.path.exists(self.backup_file):
                with open(self.backup_file, 'rb') as f:
                    self.q_values = pickle.load(f)
        except Exception:
            pass

    def __del__(self):
        self.save_q_values()

    def _compute_reward(self, agent, action_index, response: str, query: str, val_score: int) -> float:
        try:
            q_emb = gemini.st_embedder.encode(query, convert_to_tensor=True)
            a_emb = gemini.st_embedder.encode(response, convert_to_tensor=True)
            sim = float((q_emb @ a_emb).cpu()) 
            sim_scaled = sim ** 2 * 10  
        except Exception as e:
            gemini.logger.error(f"Embedding error: {e}")
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

