variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ssh_key_fingerprint" {
  description = "SSH key fingerprint for Droplet access"
  type        = string
}

variable "domain" {
  description = "Primary domain"
  type        = string
  default     = "agentc2.ai"
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "droplet_size" {
  description = "Droplet size slug"
  type        = string
  default     = "s-8vcpu-32gb"
}

variable "staging_droplet_size" {
  description = "Staging Droplet size slug"
  type        = string
  default     = "s-4vcpu-16gb"
}
