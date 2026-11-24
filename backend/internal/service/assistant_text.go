package service

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

// foldText lowercases s, drops Vietnamese diacritics and turns every run of
// punctuation into one space, so "Mỹ Tâm!" and "my tam" compare equal.
func foldText(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	lastSpace := true
	for _, r := range norm.NFD.String(strings.ToLower(s)) {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		if r == 'đ' {
			r = 'd'
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			lastSpace = false
		} else if !lastSpace {
			b.WriteByte(' ')
			lastSpace = true
		}
	}
	return strings.ReplaceAll(strings.TrimSpace(b.String()), "tphcm", "tp hcm")
}

// editDistance is the Levenshtein distance between a and b in runes.
func editDistance(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	if len(ra) == 0 {
		return len(rb)
	}
	prev := make([]int, len(rb)+1)
	cur := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev, cur = cur, prev
	}
	return prev[len(rb)]
}

// tokenMatches reports whether message token t stands for the name token u.
// Longer names tolerate a typo or two: "blackping" still finds "blackpink".
// Shorter words must match exactly: without accents, "khong" and "chong" are
// one edit apart, and a question word must not pick an event.
func tokenMatches(t, u string) bool {
	if t == u {
		return true
	}
	n := utf8.RuneCountInString(u)
	// "gdragon" is "g-dragon" typed without the hyphen.
	if n >= 5 && strings.HasSuffix(t, u) && utf8.RuneCountInString(t)-n <= 2 {
		return true
	}
	if n < 6 || t == "" || t[0] != u[0] {
		return false
	}
	maxDist := 1
	if n >= 9 {
		maxDist = 2
	}
	if d := utf8.RuneCountInString(t) - n; d > maxDist || -d > maxDist {
		return false
	}
	return editDistance(t, u) <= maxDist
}

// containsPhrase reports whether the folded text holds cue as whole words.
func containsPhrase(folded, cue string) bool {
	return strings.Contains(" "+folded+" ", " "+cue+" ")
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}
