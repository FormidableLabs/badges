. ${GITHUB_WORKSPACE}/scripts/install_volta.sh

# Install Volta using functions imported above.
check_architecture "0.6.3" "$(uname -m)" || exit 1
install_version "0.6.3" "/tmp/.volta"
# Reloading bashrc for volta
source ~/.bashrc

# Install tfenv to install the correct Terraform version.
git clone https://github.com/tfutils/tfenv.git ~/.tfenv
PATH="$HOME/.tfenv/bin:$PATH" ~/.tfenv/bin/tfenv install
# Terraform is already installed
rm /usr/local/bin/terraform
ln -s ~/.tfenv/bin/* /usr/local/bin

# Install Terragrunt.
curl -L -o /usr/local/bin/terragrunt https://github.com/gruntwork-io/terragrunt/releases/download/v0.19.28/terragrunt_linux_amd64
chmod +x /usr/local/bin/terragrunt

# Use Volta to install pinned versions of Node and Yarn.
/tmp/.volta/volta install node
/tmp/.volta/volta install yarn

# Install Yarn packages.
/tmp/.volta/bin/yarn --frozen-lockfile

if [[ ! -z "${TERRAFORM_AWS_SERVERLESS_BRANCH}" ]]; then
  git clone -v --single-branch --branch "${TERRAFORM_AWS_SERVERLESS_BRANCH}" https://github.com/FormidableLabs/terraform-aws-serverless ../terraform-aws-serverless
fi