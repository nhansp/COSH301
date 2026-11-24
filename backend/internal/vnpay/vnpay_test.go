package vnpay

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

// VNPay publishes no merchant secret, so the expected hash below was produced
// independently with: openssl dgst -sha512 -hmac FAKESECRETFORTESTS.
const (
	fixtureQuery = "vnp_Amount=1000000&vnp_Command=pay&vnp_CreateDate=20260101103111&vnp_CurrCode=VND" +
		"&vnp_ExpireDate=20260101104611&vnp_IpAddr=13.160.92.202&vnp_Locale=vn" +
		"&vnp_OrderInfo=Thanh+toan+ve+ET1234&vnp_OrderType=other" +
		"&vnp_ReturnUrl=https%3A%2F%2Fexample.test%2Fpayment%2Fvnpay%2Freturn" +
		"&vnp_TmnCode=TESTCODE&vnp_TxnRef=VNP001&vnp_Version=2.1.0"
	fixtureHash = "e62d62bfa0824666f41026f85fcc4f834144fc5efc804a19360bf2c7910635333804aa5c03fdc22c2ed9c0b503605221b162dd87e222aa86d44f9a677e9df6bc"
)

func testClient() Client {
	return Client{
		TmnCode:    "TESTCODE",
		HashSecret: "FAKESECRETFORTESTS",
		PayURL:     "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
		ReturnURL:  "https://example.test/payment/vnpay/return",
	}
}

func TestSign_MatchesOpenSSL(t *testing.T) {
	if got := Sign("FAKESECRETFORTESTS", fixtureQuery); got != fixtureHash {
		t.Fatalf("hash = %s, want %s", got, fixtureHash)
	}
}

func TestPaymentURL(t *testing.T) {
	created := time.Date(2026, 1, 1, 3, 31, 11, 0, time.UTC)
	got := testClient().PaymentURL(PayRequest{
		TxnRef:    "VNP001",
		AmountVND: 10000,
		OrderInfo: "Thanh toán vé ET1234",
		IPAddr:    "13.160.92.202",
		CreatedAt: created,
		ExpiresAt: created.Add(15 * time.Minute),
	})
	if want := "?" + fixtureQuery + "&vnp_SecureHash=" + fixtureHash; !strings.HasSuffix(got, want) {
		t.Fatalf("got %s\nwant suffix %s", got, want)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if !testClient().Verify(u.Query()) {
		t.Fatal("generated URL does not verify")
	}
}

func signedQuery(c Client, raw string) url.Values {
	q, _ := url.ParseQuery(raw)
	canon := url.Values{}
	for k, v := range q {
		canon[k] = v
	}
	q.Set("vnp_SecureHash", Sign(c.HashSecret, canonicalQuery(canon, false)))
	return q
}

func TestVerify(t *testing.T) {
	c := testClient()
	ipn := "vnp_Amount=1000000&vnp_BankCode=NCB&vnp_BankTranNo=VNP14000001&vnp_OrderInfo=Thanh+toan+ve+ET1234" +
		"&vnp_PayDate=20260101103500&vnp_ResponseCode=00&vnp_TmnCode=TESTCODE&vnp_TransactionNo=14000001" +
		"&vnp_TransactionStatus=00&vnp_TxnRef=VNP001"

	t.Run("valid", func(t *testing.T) {
		if !c.Verify(signedQuery(c, ipn)) {
			t.Fatal("valid signature rejected")
		}
	})
	t.Run("uppercase hex is accepted", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Set("vnp_SecureHash", strings.ToUpper(q.Get("vnp_SecureHash")))
		if !c.Verify(q) {
			t.Fatal("uppercase hash rejected")
		}
	})
	t.Run("legacy hash type parameter is ignored", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Set("vnp_SecureHashType", "HmacSHA512")
		if !c.Verify(q) {
			t.Fatal("vnp_SecureHashType must not be signed")
		}
	})
	t.Run("tampered amount", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Set("vnp_Amount", "100")
		if c.Verify(q) {
			t.Fatal("tampered amount accepted")
		}
	})
	t.Run("added parameter", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Set("vnp_Extra", "1")
		if c.Verify(q) {
			t.Fatal("extra signed parameter accepted")
		}
	})
	t.Run("wrong secret", func(t *testing.T) {
		other := c
		other.HashSecret = "OTHER"
		if other.Verify(signedQuery(c, ipn)) {
			t.Fatal("signature from another secret accepted")
		}
	})
	t.Run("missing hash", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Del("vnp_SecureHash")
		if c.Verify(q) {
			t.Fatal("unsigned message accepted")
		}
	})
	t.Run("empty secret never verifies", func(t *testing.T) {
		empty := c
		empty.HashSecret = ""
		q := signedQuery(empty, ipn)
		if empty.Verify(q) {
			t.Fatal("empty secret accepted")
		}
	})
	t.Run("duplicate parameter", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Add("vnp_Amount", "1")
		if c.Verify(q) {
			t.Fatal("duplicate parameter accepted")
		}
	})
	t.Run("non-vnp parameters are not signed", func(t *testing.T) {
		q := signedQuery(c, ipn)
		q.Set("utm_source", "x")
		if !c.Verify(q) {
			t.Fatal("unrelated parameter must not affect the signature")
		}
	})
	t.Run("empty value signed either way", func(t *testing.T) {
		withEmpty := ipn + "&vnp_BankTranNo2="
		q := signedQuery(c, withEmpty) // signed as "key="
		if !c.Verify(q) {
			t.Fatal("empty value signed as key= rejected")
		}
		q, _ = url.ParseQuery(withEmpty)
		canon, _ := url.ParseQuery(withEmpty)
		q.Set("vnp_SecureHash", Sign(c.HashSecret, canonicalQuery(canon, true))) // signed without it
		if !c.Verify(q) {
			t.Fatal("empty value dropped before signing rejected")
		}
	})
}

func TestFormatTime_GMT7(t *testing.T) {
	utc := time.Date(2026, 12, 31, 17, 30, 5, 0, time.UTC)
	if got := FormatTime(utc); got != "20270101003005" {
		t.Fatalf("got %s", got)
	}
}

func TestSanitizeOrderInfo(t *testing.T) {
	for in, want := range map[string]string{
		"Thanh toan ve ET1":      "Thanh toan ve ET1",
		"Thanh toán vé ET1234":   "Thanh toan ve ET1234",
		"Đặt vé Nguyễn #1 & <b>": "Dat ve Nguyen 1  b",
		"":                       "Thanh toan",
		"  ":                     "Thanh toan",
		strings.Repeat("a", 300): strings.Repeat("a", 255),
	} {
		if got := SanitizeOrderInfo(in); got != want {
			t.Errorf("SanitizeOrderInfo(%q) = %q, want %q", in, got, want)
		}
	}
}
