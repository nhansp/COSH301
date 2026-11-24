// Package vnpay builds and verifies VNPay API 2.1.0 payment messages.
// See https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html.
package vnpay

import (
	"crypto/hmac"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

const (
	version  = "2.1.0"
	command  = "pay"
	currency = "VND"

	// vnp_Amount carries VND multiplied by 100.
	AmountScale = 100

	// Response codes of a finished payment, used both by IPN and Return URL.
	CodeSuccess = "00"

	paramHash     = "vnp_SecureHash"
	paramHashType = "vnp_SecureHashType"
	paramPrefix   = "vnp_"
)

// gmt7 is the zone VNPay reads vnp_CreateDate and vnp_ExpireDate in.
// A fixed zone avoids depending on tzdata in the runtime image.
var gmt7 = time.FixedZone("GMT+7", 7*60*60)

type Client struct {
	TmnCode    string
	HashSecret string
	PayURL     string
	ReturnURL  string
}

type PayRequest struct {
	// TxnRef must be unique per payment attempt.
	TxnRef    string
	AmountVND int64
	OrderInfo string
	IPAddr    string
	CreatedAt time.Time
	ExpiresAt time.Time
}

// PaymentURL returns the VNPay checkout URL for the request, signed with HMAC-SHA512.
func (c Client) PaymentURL(r PayRequest) string {
	params := url.Values{}
	params.Set("vnp_Version", version)
	params.Set("vnp_Command", command)
	params.Set("vnp_TmnCode", c.TmnCode)
	params.Set("vnp_Amount", strconv.FormatInt(r.AmountVND*AmountScale, 10))
	params.Set("vnp_CurrCode", currency)
	params.Set("vnp_TxnRef", r.TxnRef)
	params.Set("vnp_OrderInfo", SanitizeOrderInfo(r.OrderInfo))
	params.Set("vnp_OrderType", "other")
	params.Set("vnp_Locale", "vn")
	params.Set("vnp_ReturnUrl", c.ReturnURL)
	params.Set("vnp_IpAddr", r.IPAddr)
	params.Set("vnp_CreateDate", FormatTime(r.CreatedAt))
	params.Set("vnp_ExpireDate", FormatTime(r.ExpiresAt))

	query := canonicalQuery(params, false)
	return c.PayURL + "?" + query + "&" + paramHash + "=" + Sign(c.HashSecret, query)
}

// Verify reports whether the vnp_* parameters of an IPN or Return URL carry a
// valid signature. Anything unsigned, duplicated or tampered with fails.
func (c Client) Verify(query url.Values) bool {
	got := strings.ToLower(query.Get(paramHash))
	if got == "" || c.HashSecret == "" {
		return false
	}

	signed := url.Values{}
	hasEmpty := false
	for key, vals := range query {
		if !strings.HasPrefix(key, paramPrefix) || key == paramHash || key == paramHashType {
			continue
		}
		if len(vals) != 1 {
			return false
		}
		signed.Set(key, vals[0])
		hasEmpty = hasEmpty || vals[0] == ""
	}

	// VNPay's sample code disagrees on empty values: the PHP and Node samples
	// sign them as "key=", the Java sample drops them. Accept either form.
	if equalHash(got, Sign(c.HashSecret, canonicalQuery(signed, false))) {
		return true
	}
	return hasEmpty && equalHash(got, Sign(c.HashSecret, canonicalQuery(signed, true)))
}

// SignParams returns the signature of a parameter set, for building messages
// the way VNPay would (tests, simulators).
func (c Client) SignParams(params url.Values) string {
	return Sign(c.HashSecret, canonicalQuery(params, false))
}

// Sign returns the lowercase hex HMAC-SHA512 of data.
func Sign(secret, data string) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func equalHash(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// canonicalQuery sorts the keys and URL-encodes keys and values with spaces as
// "+". The same string is signed and sent.
func canonicalQuery(params url.Values, skipEmpty bool) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if skipEmpty && v[0] == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte('&')
		}
		b.WriteString(url.QueryEscape(k))
		b.WriteByte('=')
		b.WriteString(url.QueryEscape(params.Get(k)))
	}
	return b.String()
}

// FormatTime renders t as yyyyMMddHHmmss in GMT+7.
func FormatTime(t time.Time) string {
	return t.In(gmt7).Format("20060102150405")
}

// SanitizeOrderInfo transliterates Vietnamese to ASCII and keeps letters,
// digits and spaces: VNPay asks for unaccented text without special characters.
func SanitizeOrderInfo(s string) string {
	s = strings.NewReplacer("đ", "d", "Đ", "D").Replace(s)
	var b strings.Builder
	for _, r := range norm.NFD.String(s) {
		switch {
		case unicode.Is(unicode.Mn, r):
			// Combining accent from the decomposed form.
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == ' ':
			b.WriteRune(r)
		}
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "Thanh toan"
	}
	if len(out) > 255 {
		out = out[:255]
	}
	return out
}
