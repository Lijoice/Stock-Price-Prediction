
import random
import numpy as np
from .models import ARIMAModel
from sklearn.metrics import mean_squared_error

class GeneticAlgorithm:
    def __init__(self, data, population_size=10, generations=5, mutation_rate=0.1):
        self.data = data
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.population = []
        
    def init_population(self):
        # Chromosome: (p, d, q) for ARIMA
        # p: 0-5, d: 0-2, q: 0-5
        for _ in range(self.population_size):
            p = random.randint(0, 5)
            d = random.randint(0, 2)
            q = random.randint(0, 5)
            self.population.append((p, d, q))
            
    def fitness_function(self, chromosome):
        p, d, q = chromosome
        try:
            # Train/Test split
            train_size = int(len(self.data) * 0.8)
            train, test = self.data[0:train_size], self.data[train_size:]
            
            model = ARIMAModel(order=(p, d, q))
            # Suppress warnings
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore")
                model.train(train)
                
            predictions = model.predict(steps=len(test))
            mse = mean_squared_error(test, predictions)
            return 1 / (mse + 1e-6) # Minimize MSE -> Maximize Fitness
        except Exception as e:
            # print(f"Error evaluating {chromosome}: {e}")
            return 0 # Penalize invalid models

    def selection(self, fitness_scores):
        # Roulette Wheel Selection
        total_fitness = sum(fitness_scores)
        probs = [f / total_fitness for f in fitness_scores]
        return self.population[np.random.choice(len(self.population), p=probs)]

    def crossover(self, parent1, parent2):
        # Single point crossover
        point = random.randint(1, 2)
        child1 = parent1[:point] + parent2[point:]
        child2 = parent2[:point] + parent1[point:]
        return child1, child2

    def mutation(self, chromosome):
        if random.random() < self.mutation_rate:
            # Mutate one gene
            idx = random.randint(0, 2)
            mutation_val = random.randint(0, 5) if idx != 1 else random.randint(0, 2)
            chromosome = list(chromosome)
            chromosome[idx] = mutation_val
            return tuple(chromosome)
        return chromosome

    def run(self):
        self.init_population()
        
        for gen in range(self.generations):
            fitness_scores = [self.fitness_function(ind) for ind in self.population]
            best_fitness = max(fitness_scores)
            best_ind = self.population[fitness_scores.index(best_fitness)]
            print(f"Generation {gen+1}, Best Fitness: {best_fitness:.4f}, Best Params: {best_ind}")
            
            new_population = [best_ind] # Elitism
            
            while len(new_population) < self.population_size:
                parent1 = self.selection(fitness_scores)
                parent2 = self.selection(fitness_scores)
                child1, child2 = self.crossover(parent1, parent2)
                new_population.append(self.mutation(child1))
                if len(new_population) < self.population_size:
                    new_population.append(self.mutation(child2))
            
            self.population = new_population

        return best_ind
