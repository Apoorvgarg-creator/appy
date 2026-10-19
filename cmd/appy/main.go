package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"appy/internal/hub"
	"appy/internal/mobile"
)

func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func run() error {
	addr := flag.String("addr", "127.0.0.1:8787", "explicit IPv4 loopback address")
	dataDir := flag.String("data-dir", ".data/appy", "private development snapshot directory")
	webDir := flag.String("web-dir", "web/dist", "built static frontend directory")
	mobileOrigin := flag.String("mobile-origin", "", "optional exact HTTPS Tailscale origin for paired browsers")
	mobileAddr := flag.String("mobile-addr", "127.0.0.1:8788", "loopback backend for Tailscale Serve; never expose the local controller")
	flag.Parse()
	if err := hub.ValidateAddress(*addr); err != nil {
		return err
	}
	if err := mobile.ValidateOrigin(*mobileOrigin); err != nil {
		return err
	}
	if *mobileOrigin != "" {
		if err := hub.ValidateAddress(*mobileAddr); err != nil {
			return err
		}
		if *mobileAddr == *addr {
			return fmt.Errorf("mobile gateway and local controller need different loopback ports")
		}
	}
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		return fmt.Errorf("Appy could not listen at %s: %w", *addr, err)
	}
	defer listener.Close()
	listeners := []net.Listener{listener}
	if *mobileOrigin != "" {
		remoteListener, err := net.Listen("tcp", *mobileAddr)
		if err != nil {
			return fmt.Errorf("Appy mobile gateway could not listen at %s: %w", *mobileAddr, err)
		}
		defer remoteListener.Close()
		listeners = append(listeners, remoteListener)
	}
	store, err := hub.OpenStore(*dataDir)
	if err != nil {
		return err
	}
	defer store.Close()
	handler, err := hub.NewHandler(store, *addr, *webDir)
	if err != nil {
		return err
	}
	gateway, err := mobile.New(handler, *addr, *mobileOrigin)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	newServer := func(h http.Handler) *http.Server {
		return &http.Server{Handler: h, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
	}
	servers := []*http.Server{newServer(gateway.LocalHandler())}
	if *mobileOrigin != "" {
		servers = append(servers, newServer(gateway.RemoteHandler()))
	}
	runnerDone := make(chan struct{})
	go func() { defer close(runnerDone); store.Run(ctx, time.Second) }()
	serveErrors := make(chan error, len(servers))
	for i, server := range servers {
		go func() { serveErrors <- server.Serve(listeners[i]) }()
	}
	fmt.Printf("Appy listening at http://%s\n", *addr)
	log.Print("Development fixture: no model integration or real device control")
	if *mobileOrigin != "" {
		log.Printf("Paired-browser gateway at %s, expecting %s through private Tailscale Serve", *mobileAddr, *mobileOrigin)
	}
	select {
	case <-ctx.Done():
	case err = <-serveErrors:
	}
	stop()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, server := range servers {
		if shutdownErr := server.Shutdown(shutdownCtx); shutdownErr != nil {
			_ = server.Close()
		}
	}
	<-runnerDone
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}
