# Build stage
FROM golang:1.24.0-alpine3.21 AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency specifications
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Compile static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/api ./cmd/api

# Final runtime stage
FROM alpine:3.21

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/api /app/api

USER appuser

EXPOSE 8080

CMD ["/app/api"]
