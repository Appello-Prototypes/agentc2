resource "digitalocean_droplet" "production" {
  name     = "agentc2-prod-1"
  region   = var.region
  size     = var.droplet_size
  image    = "ubuntu-24-04-x64"
  ssh_keys = [var.ssh_key_fingerprint]

  tags = ["agentc2", "production", "web"]

  user_data = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y curl git
    # Install Bun
    curl -fsSL https://bun.sh/install | bash
    # Install Caddy
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install -y caddy
    # Install PM2
    npm install -g pm2
  EOF

  lifecycle {
    create_before_destroy = true
  }
}

resource "digitalocean_droplet" "production_2" {
  name     = "agentc2-prod-2"
  region   = var.region
  size     = var.droplet_size
  image    = "ubuntu-24-04-x64"
  ssh_keys = [var.ssh_key_fingerprint]

  tags = ["agentc2", "production", "web"]

  user_data = digitalocean_droplet.production.user_data

  lifecycle {
    create_before_destroy = true
  }
}

resource "digitalocean_droplet" "staging" {
  name     = "agentc2-staging"
  region   = var.region
  size     = var.staging_droplet_size
  image    = "ubuntu-24-04-x64"
  ssh_keys = [var.ssh_key_fingerprint]

  tags = ["agentc2", "staging", "web"]

  user_data = digitalocean_droplet.production.user_data

  lifecycle {
    create_before_destroy = true
  }
}
