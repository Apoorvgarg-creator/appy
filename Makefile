export GOCACHE := $(CURDIR)/.cache/go
export GOTOOLCHAIN := local

.PHONY: setup generate build start run dev test check

setup:
	npm ci --ignore-scripts

generate:
	npm run generate

build:
	npm run build
	mkdir -p bin
	go build -o bin/appy ./cmd/appy

start:
	npm start

run: build
	npm start

dev:
	npm run dev

test:
	go test -race ./...
	npm test

check:
	npm run check:contract
	npm run typecheck
	go vet ./...
