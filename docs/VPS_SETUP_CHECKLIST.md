# VPS Setup Quick Checklist

## Pre-Deployment Checklist
- [ ] VPS provisioned (Ubuntu 22.04 LTS recommended)
- [ ] Domain name pointed to VPS IP
- [ ] SSL certificate planned (Let's Encrypt)
- [ ] All required credentials and API keys obtained

## Server Setup (Section 1-2)
- [ ] System updates installed
- [ ] Application user created
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Timezone set correctly
- [ ] Docker and Docker Compose installed
- [ ] Docker auto-start enabled

## Application Setup (Section 3)
- [ ] Repository cloned to VPS
- [ ] Production directories created
- [ ] Production Docker Compose file created
- [ ] Log directories created

## Database Setup (Section 4)
- [ ] Secure passwords generated for all services
- [ ] Secret files created with proper permissions
- [ ] Production environment file created
- [ ] PostgreSQL initialized with schema
- [ ] Database initialization verified
- [ ] Admin accounts created and tested

## SSL Setup (Section 5)
- [ ] Certbot installed
- [ ] Nginx production configuration created
- [ ] SSL certificate obtained
- [ ] Auto-renewal configured
- [ ] HTTPS redirect tested

## Environment Configuration (Section 6)
- [ ] All secret files created (SMTP, R2, Payment gateways)
- [ ] Domain names updated in all config files
- [ ] Environment variables verified
- [ ] API keys and credentials tested

## Service Deployment (Section 7)
- [ ] Production images built
- [ ] All services deployed
- [ ] Service health checks passing
- [ ] API endpoints responding
- [ ] Frontend loading correctly
- [ ] Admin panel accessible

## Monitoring & Logging (Section 8)
- [ ] Log rotation configured
- [ ] Monitoring script created and scheduled
- [ ] Health check endpoints working
- [ ] Notification webhooks configured
- [ ] Log aggregation working

## Backup Strategy (Section 9)
- [ ] Database backup script created
- [ ] File backup script created
- [ ] Backup schedules configured
- [ ] Backup retention policy set
- [ ] Backup restoration tested

## Security Hardening (Section 10)
- [ ] SSH security configured
- [ ] Fail2ban installed and configured
- [ ] Docker security settings applied
- [ ] SSL/TLS security verified
- [ ] Firewall rules verified

## Performance Optimization (Section 11)
- [ ] Database optimization applied
- [ ] Redis optimization configured
- [ ] Nginx caching enabled
- [ ] Static asset compression enabled
- [ ] CDN configured (if applicable)

## Maintenance Setup (Section 12)
- [ ] Daily maintenance script scheduled
- [ ] Weekly maintenance script scheduled
- [ ] Monthly maintenance script scheduled
- [ ] System update automation configured
- [ ] Log cleanup automated

## Post-Deployment Verification
- [ ] Full application functionality tested
- [ ] Payment gateway integration tested
- [ ] Email sending verified
- [ ] File uploads working
- [ ] Search functionality working
- [ ] Admin features tested
- [ ] Mobile responsiveness verified
- [ ] Load testing performed
- [ ] Security scan completed

## Documentation & Handover
- [ ] All credentials documented securely
- [ ] Emergency procedures documented
- [ ] Support contacts updated
- [ ] Monitoring dashboards configured
- [ ] Team training completed

## Ongoing Monitoring
- [ ] Uptime monitoring configured
- [ ] Performance monitoring active
- [ ] Error tracking implemented
- [ ] Security monitoring enabled
- [ ] Backup monitoring active

---

## Critical Path Items (Must Complete Before Going Live)

1. **Database Security**: Strong passwords, proper user permissions
2. **SSL Certificate**: Valid HTTPS setup
3. **Payment Integration**: Test transactions in sandbox/live mode
4. **Email Configuration**: Verify all email templates work
5. **Backup System**: Test restore procedures
6. **Monitoring**: Ensure all health checks work
7. **Security**: Firewall, SSL, and access control verified

---

## Emergency Contacts
- **Primary Admin**: [Name] - [Email] - [Phone]
- **Secondary Admin**: [Name] - [Email] - [Phone]
- **DevOps Support**: [Name] - [Email] - [Phone]
- **Hosting Provider**: [Provider] - [Support Contact]

---

## Important Notes
- Always test backup restoration procedures
- Monitor disk space usage closely
- Keep all software packages updated
- Review security logs weekly
- Test disaster recovery quarterly
- Document any custom configurations
