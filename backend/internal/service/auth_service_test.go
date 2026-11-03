package service

import (
	"testing"
)

func TestHashString_Consistency(t *testing.T) {
	h1 := HashString("123456")
	h2 := HashString("123456")
	if h1 != h2 {
		t.Errorf("expected hashes to match, got %s and %s", h1, h2)
	}

	h3 := HashString("654321")
	if h1 == h3 {
		t.Errorf("different inputs should produce different hashes")
	}
}

func TestGenerateToken_LengthAndRandomness(t *testing.T) {
	t1, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if len(t1) != 64 { // 32 bytes hex encoded = 64 chars
		t.Errorf("expected token length 64, got %d", len(t1))
	}

	t2, _ := GenerateToken()
	if t1 == t2 {
		t.Errorf("two generated tokens should not be identical")
	}
}
