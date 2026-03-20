# Start from the official lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code into the container
COPY . .

# Expose port 8080 (Google Cloud Run's default expected port)
EXPOSE 8080

# Command to run the uvicorn server on port 8080.
# We map host to 0.0.0.0 so the container is accessible from the outside.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
