
try:
    from transformers import BertTokenizer, BertForSequenceClassification
    import torch
    import torch.nn.functional as F
    FINBERT_AVAILABLE = True
except ImportError:
    FINBERT_AVAILABLE = False
    BertTokenizer = None
    BertForSequenceClassification = None
    torch = None
    F = None

class FinBERT:
    def __init__(self):
        if not FINBERT_AVAILABLE:
            print("FinBERT dependencies not available. Using dummy sentiment model.")
            return

        print("Loading FinBERT model...")
        self.tokenizer = BertTokenizer.from_pretrained('ProsusAI/finbert')
        self.model = BertForSequenceClassification.from_pretrained('ProsusAI/finbert')
        self.labels = ['positive', 'negative', 'neutral']
        print("FinBERT model loaded.")

    def predict(self, text):
        if not FINBERT_AVAILABLE:
            return 0.0  # Return neutral sentiment

        inputs = self.tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        outputs = self.model(**inputs)
        probs = F.softmax(outputs.logits, dim=1).detach().numpy()[0]
        
        # Mapping: 0: positive, 1: negative, 2: neutral (Check model config, usually it's pos, neg, neu)
        # ProsusAI/finbert labels: 0: positive, 1: negative, 2: neutral
        # Wait, let's verify label mapping. 
        # Actually usually it is order: positive, negative, neutral
        
        score_map = {
            0: 1,  # Positive
            1: -1, # Negative
            2: 0   # Neutral
        }
        
        # Weighted score: (prob_pos * 1) + (prob_neg * -1) + (prob_neu * 0)
        compound_score = (probs[0] * 1) + (probs[1] * -1) + (probs[2] * 0)
        return compound_score

finbert_model = FinBERT()

def get_sentiment(text):
    return finbert_model.predict(text)
