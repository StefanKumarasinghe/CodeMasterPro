import random
import os
import pickle

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


if __name__ == "__main__":
    actions = ["accept", "reject", "modify"]
    agent = RLAgent(actions)
    agent.update_q_value(0, 1.0)
    agent.update_q_value(1, -1.0)
    agent.update_q_value(2, 0.5)
    print("Q-values:", agent.q_values)
    print("Selected action:", agent.select_action())
