output "production_droplet_1_ip" {
  value = digitalocean_droplet.production.ipv4_address
}

output "production_droplet_2_ip" {
  value = digitalocean_droplet.production_2.ipv4_address
}

output "staging_droplet_ip" {
  value = digitalocean_droplet.staging.ipv4_address
}

output "load_balancer_ip" {
  value = digitalocean_loadbalancer.production.ip
}

output "backups_bucket" {
  value = digitalocean_spaces_bucket.backups.bucket_domain_name
}
