resource "digitalocean_loadbalancer" "production" {
  name   = "agentc2-lb"
  region = var.region

  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"
    target_port    = 443
    target_protocol = "https"
    tls_passthrough = true
  }

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"
    target_port    = 80
    target_protocol = "http"
  }

  healthcheck {
    protocol               = "http"
    port                   = 3001
    path                   = "/api/health"
    check_interval_seconds = 10
    response_timeout_seconds = 5
    healthy_threshold      = 3
    unhealthy_threshold    = 3
  }

  droplet_ids = [
    digitalocean_droplet.production.id,
    digitalocean_droplet.production_2.id,
  ]

  sticky_sessions {
    type = "none"
  }

  redirect_http_to_https = true
  enable_proxy_protocol  = false
}

resource "digitalocean_firewall" "web" {
  name = "agentc2-web-firewall"

  droplet_ids = [
    digitalocean_droplet.production.id,
    digitalocean_droplet.production_2.id,
    digitalocean_droplet.staging.id,
  ]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_spaces_bucket" "backups" {
  name   = "agentc2-backups"
  region = var.region
  acl    = "private"

  lifecycle_rule {
    enabled = true
    expiration {
      days = 90
    }
  }
}
