# Use an official Python runtime as a parent image
FROM python:3.11-slim-buster
# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any dependencies specified in requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Make port 80 available to the world outside this container
EXPOSE 80

# Run app.py when the container launches
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "80"]